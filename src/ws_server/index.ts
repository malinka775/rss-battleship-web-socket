import { WebSocketServer, WebSocket } from "ws";
import { ClientMessage, ClientMessageTypes, ServerMessageTypes } from "./interfaces.ts";
import { regUser, getWinners } from "./db/users.ts";
import { UUID } from "node:crypto";
import { createRoom, getRoomPlayers, updateRooms } from "./db/rooms.ts";
import { addShips, attack, createGame, getRandomEnemyCoordinates } from "./db/games.ts";


const clients: Record<UUID, WebSocket> = {}

export const startWS = (port: number) => {
  const wss = new WebSocketServer({port});

  console.log('web socket server runs on port ', port);

  wss.on('connection', (ws) => {
    let currentUserId: UUID;
    console.log('new client connected!');

    ws.on('message', (message) => {
      const {type, data, id} = JSON.parse(message.toString()) as ClientMessage;

      if (type === ClientMessageTypes.REG_USER) {
        const user = JSON.parse(data);
        const {userData, roomData} = regUser(user);

        const userMessage = JSON.stringify({
          type: ServerMessageTypes.REG_USER,
          data: JSON.stringify(userData),
          id: 0,
        })
        
        const roomMessage = JSON.stringify({
          type: ServerMessageTypes.UPD_ROOM,
          data: JSON.stringify(roomData),
          id: 0,
        })
        const winners = getWinners();
        const winnersMessage = JSON.stringify({
          type: ServerMessageTypes.UPD_WINNERS,
          data: JSON.stringify(winners),
          id: 0,
        })

        ws.send(userMessage);
        currentUserId = userData.index;
        clients[currentUserId] = ws;
        ws.send(roomMessage);
        ws.send(winnersMessage);
      }

      if(type === ClientMessageTypes.CREATE_ROOM) {
        const roomData = createRoom(currentUserId!);
        const roomMessage = JSON.stringify({
          type: ServerMessageTypes.UPD_ROOM,
          data: JSON.stringify(roomData),
          id: 0,
        })
        Object.values(clients).forEach((client) => {
          client.send(roomMessage);
        })
      }

      if(type === ClientMessageTypes.ADD_USER_TO_ROOM) {
        const {data} = JSON.parse(message.toString()) as ClientMessage;
        const roomId = JSON.parse(data).indexRoom;

        const roomPlayerId = getRoomPlayers(roomId);
        const updatedRooms = updateRooms(roomId, currentUserId);

        if(!roomPlayerId) {
          const roomMessage = JSON.stringify({
            type: ServerMessageTypes.UPD_ROOM,
            data: JSON.stringify(updatedRooms),
            id: 0,
          })
          ws.send(roomMessage);
        } else {
          if (roomPlayerId === currentUserId) {
            return;
          }
          const {playerIds, toPlayers, toAll} = createGame(roomId, currentUserId);
          playerIds.forEach((playerId) => {
            clients[playerId].send(JSON.stringify({
              type: ServerMessageTypes.CREATE_GAME,
              data: JSON.stringify(toPlayers[playerId]),
              id: 0,
            }))
          })
          Object.values(clients).forEach((client) => {
            client.send(JSON.stringify({
              type: ServerMessageTypes.UPD_ROOM,
              data: JSON.stringify(toAll),
              id: 0,
            }))
          })
        }
      }

      if(type === ClientMessageTypes.ADD_SHIPS) {
        const {gameId, ships} = JSON.parse(data);
        const {isGameStart, toPlayers, playerIds, turn} = addShips(gameId, ships, currentUserId);
        if (isGameStart) {
          playerIds.forEach((playerId) => {
            const currentClient = clients[playerId];
            currentClient.send(JSON.stringify({
              type: ServerMessageTypes.START_GAME,
              data: JSON.stringify(toPlayers[playerId]),
              id: 0,
            }))
            currentClient.send(JSON.stringify({
              type: ServerMessageTypes.TURN,
              data: JSON.stringify(turn),
              id: 0,
            }))
          })
        }
      }

      if(type === ClientMessageTypes.ATTACK || type === ClientMessageTypes.RANDOM_ATTACK) {
        let {gameId, x, y, indexPlayer} = JSON.parse(data);
        
        if (type === ClientMessageTypes.RANDOM_ATTACK) {
          const coordinate = getRandomEnemyCoordinates(gameId, indexPlayer);

          x = coordinate?.x;
          y = coordinate?.y;
        }

        const result = attack(gameId, x, y, indexPlayer);
        if (result) {
          const {turn, attackResult, playerIds, deactivatedCellsAround, isFinished} = result;
          playerIds.forEach((id) => {
            const currentClient = clients[id];

            currentClient.send(JSON.stringify({
              type: ServerMessageTypes.ATTACK,
              data: JSON.stringify(attackResult),
              id: 0,
            }))

            if (deactivatedCellsAround.length > 0) {
              deactivatedCellsAround.forEach((cell) => {
                currentClient.send(JSON.stringify({
                  type: ServerMessageTypes.ATTACK,
                  data: JSON.stringify(cell),
                  id: 0,
                }));

                currentClient.send(JSON.stringify({
                  type: ServerMessageTypes.TURN,
                  data: JSON.stringify(turn),
                  id: 0,
                }))
              })
            } else {
              currentClient.send(JSON.stringify({
                type: ServerMessageTypes.TURN,
                data: JSON.stringify(turn),
                id: 0,
              }))
            }

            if (isFinished) {
              currentClient.send(JSON.stringify({
                type: ServerMessageTypes.FINISH_GAME,
                data: JSON.stringify({
                  winPlayer: indexPlayer,
                }),
                id: 0,
              }))
            }
          })
          if(isFinished) {
            const winners = getWinners();
            Object.values(clients).forEach((client) => {
              client.send(JSON.stringify({
                type: ServerMessageTypes.UPD_WINNERS,
                data: JSON.stringify(winners),
                id: 0,
              }))
            })
          }
        }
      }
    })
  })

  wss.on('close', () => {
    console.log('WebSocket connection was closed');
  })
}

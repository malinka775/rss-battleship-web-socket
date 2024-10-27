import { createWebSocketStream, WebSocketServer, WebSocket } from "ws";
import {ClientMessage, ClientMessageTypes, ServerMessageTypes, User} from "./interfaces.ts";
import { addShips, attack, createGame, createRoom, getRoomPlayersNumber, regUser, updateRoom, updateWinners } from "./db/users.ts";
import { UUID } from "node:crypto";

const port = 3000;

const clients: Record<UUID, WebSocket> = {

}

export const startWS = () => {
  const wss = new WebSocketServer({port});

  console.log('web socket server runs on port ', port);

  wss.on('connection', (ws) => {
    let currentUserId: UUID;
    console.log('new client connected!');
    //handle new connections
    ws.on('message', (message) => {
      const {type, data, id} = JSON.parse(message.toString()) as ClientMessage;

      console.log(type, data, id)

      if (type === ClientMessageTypes.REG_USER) { //TODO: send upd_room and upd_winners with data: "[]",
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
        const winners = updateWinners();
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

        console.log('clients', clients);

      }

      if(type === ClientMessageTypes.CREATE_ROOM) { //TODO: send upd_room with room data
        const roomData = createRoom(currentUserId!); //TODO: remove mock
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

        const isRoomEmpty = !getRoomPlayersNumber(roomId);
        console.log('isRoomEmpty',isRoomEmpty);

        if(isRoomEmpty) {
          const updatedRoom = updateRoom(roomId, currentUserId);

          const roomMessage = JSON.stringify({
            type: ServerMessageTypes.UPD_ROOM,
            data: JSON.stringify(updatedRoom),
            id: 0,
          })
          ws.send(roomMessage);
        } else {
          const {playerIds, toPlayers, toAll} = createGame(roomId, currentUserId);
          playerIds.forEach((playerId) => {
            console.log('trying to reach clients by id', playerId)
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

      if(type === ClientMessageTypes.ATTACK) {
        const {gameId, x, y, indexPlayer} = JSON.parse(data);

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
            const winners = updateWinners();
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

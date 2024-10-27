import { UUID, randomUUID } from "crypto";
import { User } from "../interfaces";

const users : {[key: UUID]: User} = {};
const rooms: {[key: UUID]: Room } = {};
const games: {[key: UUID]: Game} = {};
let winners: Winner[] = [];

interface Winner {
  name: string,
  wins: number,
}

interface RoomUser {
  name: string,
  index: UUID,
}

interface Room {
  roomId: UUID; //room id
  roomUsers: RoomUser[],
}

interface Game {
  gameUsers: RoomUser[];
  gameUserIds:UUID[];
  gameId: UUID;
  ships?: {
    [key: UUID]: ShipWithCoordinates[];
  };
  turn?: UUID;
};

interface UserRegResponse {
  name: string;
  index: UUID;
  error: boolean;
  errorText: string;
}

interface WinnersResponseItem {
  name: string;
  wins: number;
}

type ShipType = 'huge' | 'large' | 'medium' | 'small';


interface RawShip {
  position: {x: number, y: number, alive: boolean};
  direction: boolean, //false - horizontal, true - vertical,
  length: 1 | 2 | 3 | 4,
  type: ShipType,
}

interface ShipWithCoordinates extends RawShip {
  coordinates: {x: number, y: number, alive: boolean}[];
}

type AttackStatus = "miss"|"killed"|"shot";

export const regUser = (user: User): {userData: UserRegResponse, roomData: Room[]} => {
  const id = randomUUID();
  users[id] = user;
  return {
    userData: {
      name: user.name,
      index: id,
      error: false,
      errorText: '',
    },
    roomData: Object.values(rooms),
  }
}

export const createRoom = (userId: UUID): Room[] => {
  const roomId = randomUUID();
  const newRoomData = {
    roomId,
    roomUsers: []
  }
  rooms[roomId] = newRoomData;
  return Object.values(rooms);
}

export const updateRoom = (roomId: UUID, userId: UUID): Room[] => {
  const room = rooms[roomId];
  if(
    room.roomUsers.length === 1 &&
    room.roomUsers[0].index === userId
  ) {
    return Object.values(rooms);
  }

  room.roomUsers.push({
    name: users[userId].name,
    index: userId,
  })

  return Object.values(rooms);
}

export const getRoomPlayers = (roomId: UUID): UUID | null => {
  const isRoomEmpty = rooms[roomId].roomUsers.length === 0
  if (isRoomEmpty) {
    return null
  } else {
    return rooms[roomId].roomUsers[0].index;
  }
}

export const createGame = (roomId: UUID, userId: UUID) => {
  updateRoom(roomId, userId);
  const fullRoom = rooms[roomId];
  const [userId_1, userId_2] = fullRoom.roomUsers.map((user) => user.index);
  games[roomId] = {
    gameId: fullRoom.roomId,
    gameUsers: fullRoom.roomUsers,
    gameUserIds: [userId_1, userId_2],
  }
  delete rooms[roomId];


  return {
    playerIds: [userId_1, userId_2],
    toPlayers: {
      [userId_1]: {
        idPlayer: userId_1,
        idGame: fullRoom.roomId
      },
      [userId_2]: {
        idPlayer: userId_2,
        idGame: fullRoom.roomId
      }
    },
    toAll: Object.values(rooms)
  }
}

export const addShips = (gameId: UUID, ships: RawShip[], userId:UUID) => {
  const currentGame = games[gameId];
  if (!currentGame.ships) {
    currentGame.ships = {};
  };
  const shipsWithCoordinates = ships.map((ship) => {
    const coordinates: {x:number, y:number, alive: boolean}[] = [];
    if(!ship.direction) { //Horizontal
      const y = ship.position.y
      for (let i = 0; i < ship.length; i++) {
        coordinates.push({x: ship.position.x + i, y, alive: true})
      }
    } else {
      const x = ship.position.x;
      for (let i = 0; i < ship.length; i++) {
        coordinates.push({x, y: ship.position.y + i, alive: true})
      }
    }
    return {
      ...ship,
      coordinates,
    };
  })
  currentGame.ships[userId] = shipsWithCoordinates;

  if(Object.keys(currentGame.ships).length > 1){
    const [userId_1, userId_2] = Object.keys(currentGame.ships) as UUID[];
    currentGame.gameUserIds = [userId_1, userId_2];
    currentGame.turn = userId_1;
    return {
      isGameStart: true,
      playerIds: [userId_1, userId_2],
      toPlayers: {
        [userId_1]: {
          ships: currentGame.ships[userId_1],
          currentPlayerIndex: userId_1,
        },
        [userId_2]: {
          ships: currentGame.ships[userId_2],
          currentPlayerIndex: userId_2,
        }
      },
      turn: {
        currentPlayer: currentGame.turn,
      }
    };
  } else {
    return {
      isGameStart: false,
      playerIds: [],
      toPlayers: {},
      turn: undefined,
    }
  }
}

export const attack = (gameId: UUID, x: number, y: number, playerId: UUID) => {
  const currentGame = games[gameId];

  if(playerId !== currentGame.turn) {
    return
  }

  const underAttackPlayerId = currentGame.gameUserIds.find((id) => id !== playerId)!;
  let attackStatus: AttackStatus;
  let nextTurnId = playerId;
  let deactivatedCellsAround: any[] = [];
  let isFinished = false;

  const attackTargetShip = currentGame.ships![underAttackPlayerId].find((ship) => {
    const coordinate = ship.coordinates.find((coordinates) => coordinates.x === x && coordinates.y === y)

    if(coordinate) {
      coordinate.alive = false;
    }
    return coordinate;
  })

  if (attackTargetShip) {
    const isAlive = attackTargetShip.coordinates.filter((coordinate) => coordinate.alive).length > 0
    attackStatus = isAlive ? 'shot' : 'killed';
    if (attackStatus === 'killed') {
      if(!attackTargetShip.direction) { //Horizontal
        const shipY = attackTargetShip.coordinates[0].y;
        let shipAroundY:number[] = [];
        const shipXes = attackTargetShip.coordinates.map(({x}) => x)!;
        let shipAroundX: number[] = [...shipXes];
        const minX = shipXes[0];
        const maxX = shipXes[attackTargetShip.length - 1];
        if (minX !== 0) {
          shipAroundX.push(minX - 1)
          deactivatedCellsAround.push({
            position: {x: minX - 1, y: shipY, },
            currentPlayer: playerId,
            status: 'miss',
          })
        }
        if (maxX !== 9) {
          shipAroundX.push(maxX + 1)
          deactivatedCellsAround.push({
            position: {x: maxX + 1, y: shipY, },
            currentPlayer: playerId,
            status: 'miss',
          })
        }
        if (shipY !== 0) {
          shipAroundY.push(shipY - 1)
        }
        if (shipY !== 9) {
          shipAroundY.push(shipY + 1)
        }

        shipAroundY.forEach((y) => {
          shipAroundX.forEach((x) => {
            deactivatedCellsAround.push({
              position: {
                x,
                y
              },
              currentPlayer: playerId,
              status: 'miss',
            })
          })
        })
      } else {
        //Vertical
        const shipX = attackTargetShip.coordinates[0].x;
        let shipAroundX:number[] = [];
        const shipYs = attackTargetShip.coordinates.map(({y}) => y)!;

        let shipAroundY: number[] = [...shipYs];
        const minY = shipYs[0];
        const maxY = shipYs[attackTargetShip.length - 1];
        if (minY !== 0) {
          shipAroundY.push(minY - 1)
          deactivatedCellsAround.push({
            position: {y: minY - 1, x: shipX, },
            currentPlayer: playerId,
            status: 'miss',
          })
        }
        if (maxY !== 9) {
          shipAroundY.push(maxY + 1)
          deactivatedCellsAround.push({
            position: {y: maxY + 1, x: shipX, },
            currentPlayer: playerId,
            status: 'miss',
          })
        }
        if (shipX !== 0) {
          shipAroundX.push(shipX - 1)
        }
        if (shipX !== 9) {
          shipAroundX.push(shipX + 1)
        }

        shipAroundX.forEach((x) => {
          shipAroundY.forEach((y) => {
            deactivatedCellsAround.push({
              position: {
                x,
                y
              },
              currentPlayer: playerId,
              status: 'miss',
            })
          })
        })
      }
    }
    const updatedShips = currentGame.ships![underAttackPlayerId].filter((ship) => {
      return !ship.coordinates.every((item) => !item.alive)
    })
    if (updatedShips.length === 0) {
      isFinished = true;
      if (!users[playerId].wins) {
        users[playerId].wins = 1;
      } else {
        users[playerId].wins = users[playerId].wins + 1;
      }
    }
  } else {
    attackStatus = 'miss'
    nextTurnId = underAttackPlayerId;
  }

  currentGame.turn = nextTurnId;

  return {
    turn: {
      currentPlayer: nextTurnId
    },
    isFinished,
    attackResult: {
      position: {
        x,
        y
      },
      currentPlayer: playerId,
      status: attackStatus,
    },
    deactivatedCellsAround,
    playerIds: currentGame.gameUserIds,
  }
}

export const updateWinners = (): Winner[] => {
  const usersCopy = JSON.parse(JSON.stringify(users)) as {[key: UUID]: User};
  winners = Object.values(usersCopy).filter(user => !!user.wins).map(({name, wins}) => ({name, wins})) as Winner[];
  winners.sort((w1, w2) => w1.wins - w2.wins)

  return winners;
}

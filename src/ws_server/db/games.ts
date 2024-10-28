import { UUID } from "node:crypto";
import { RoomUser } from "../interfaces";
import { deleteRoomById, getRoomById } from "./rooms";
import { getRandomIndex } from "../../helpers";
import { incrementUserWins } from "./users";

const games: {[key: UUID]: Game} = {};

interface Game {
  gameUsers: GamePlayer[];
  gameUserIds:UUID[];
  gameId: UUID;
  ships?: {
    [key: UUID]: ShipWithCoordinates[];
  };
  turn?: UUID;
};

interface GamePlayer  extends RoomUser {
  enemyField: GameCoordinate[][],
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

interface Coordinate {
  x: number,
  y: number,
}

interface GameCoordinate extends Coordinate {
  isShot: boolean,
}

export const generateNewGameField = (): GameCoordinate[][] => {
  let coordinates: GameCoordinate[][] = [];
  for (let y = 0; y < 10; y++) {
    let currentLevelCoordinates:GameCoordinate[] = []
    for (let x = 0; x < 10; x++) {
      currentLevelCoordinates.push({
        x,
        y,
        isShot: false,
      })
    }
    coordinates.push(currentLevelCoordinates);
  }

  return coordinates;
}

export const initiateGamePlayers = (roomId: UUID): GamePlayer[] => {
  const currentRoom = getRoomById(roomId);

  const currentPlayers = currentRoom.roomUsers.map((user) => {
    (user as GamePlayer).enemyField = generateNewGameField();
    return user as GamePlayer;
  })

  return currentPlayers
}

export const createGame = (roomId: UUID, userId: UUID) => {
  const players = initiateGamePlayers(roomId);

  const [userId_1, userId_2] = players.map((player) => player.index)

  games[roomId] = {
    gameId: roomId,
    gameUsers: players,
    gameUserIds: [userId_1, userId_2],
  }
  
  const updatedRoomsArray = deleteRoomById(roomId);

  return {
    playerIds: [userId_1, userId_2],
    toPlayers: {
      [userId_1]: {
        idPlayer: userId_1,
        idGame: roomId
      },
      [userId_2]: {
        idPlayer: userId_2,
        idGame: roomId
      }
    },
    toAll: updatedRoomsArray
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

const updatePlayersIntel = (gameId: UUID, playerId: UUID, coordinate: Coordinate) : boolean => {
  const currentGame = games[gameId];
  const gamePlayerToUpdate = currentGame.gameUsers.find((user) => user.index === playerId)!;
  const fieldToUpdate = gamePlayerToUpdate.enemyField;

  if (fieldToUpdate[coordinate.y][coordinate.x].isShot) {
    return false;
  }

  fieldToUpdate[coordinate.y][coordinate.x].isShot = true;
  return true
}

export const getRandomEnemyCoordinates = (gameId: UUID, playerId: UUID): Coordinate | null => {
  const currentGame = games[gameId];

  const currentPlayer = currentGame.gameUsers.find((user) => user.index === playerId) as GamePlayer;

  const enemyPlayerAvailableCoordinates = currentPlayer.enemyField
  .reduce((acc, coordinates) => acc.concat(coordinates), [])
  .filter((coordinate) => coordinate.isShot === false);

  if (enemyPlayerAvailableCoordinates.length === 0){
    return null
  }

  const randomCellIndex = getRandomIndex(enemyPlayerAvailableCoordinates.length);

  return enemyPlayerAvailableCoordinates[randomCellIndex];
}

export const attack = (gameId: UUID, x: number, y: number, playerId: UUID) => {
  const currentGame = games[gameId];

  if(playerId !== currentGame.turn) {
    return
  }

  if(!updatePlayersIntel(gameId, playerId, {x, y})) {
    return
  };

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
      deactivatedCellsAround.forEach((cell) => updatePlayersIntel(gameId, playerId, cell.position))
    }
    const updatedShips = currentGame.ships![underAttackPlayerId].filter((ship) => {
      return !ship.coordinates.every((item) => !item.alive)
    })
    if (updatedShips.length === 0) {
      isFinished = true;
      incrementUserWins(playerId)
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

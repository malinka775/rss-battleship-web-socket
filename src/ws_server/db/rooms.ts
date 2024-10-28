import { UUID, randomUUID } from "node:crypto";
import { RoomUser, User } from "../interfaces";
import { getUserfromUserDB } from "./users";

export const rooms: {[key: UUID]: Room } = {};

export interface Room {
  roomId: UUID; //room id
  roomUsers: RoomUser[],
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

export const updateRooms = (roomId: UUID, userId: UUID): Room[] => {
  const room = rooms[roomId];
  if(
    room.roomUsers.length === 1 &&
    room.roomUsers[0].index === userId
  ) {
    return Object.values(rooms);
  }

  room.roomUsers.push({
    name: getUserfromUserDB(userId).name,
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

export const getRoomsArray = (): Room[] => {
  return Object.values(rooms);
}

export const getRoomById = (id: UUID): Room => {
  return rooms[id];
}

export const deleteRoomById = (id: UUID): Room[] => {
  delete rooms[id];

  return Object.values(rooms);
}

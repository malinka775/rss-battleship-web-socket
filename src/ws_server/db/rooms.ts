import { UUID, randomUUID } from "node:crypto";
import { RoomUser, User } from "../interfaces";
import { getUserfromUserDB } from "./users";

export const rooms: {[key: UUID]: Room } = {};

export interface Room {
  roomId: UUID; //room id
  roomUsers: RoomUser[],
}

export const createRoom = (userId: UUID): Room[] => {
  const isUserAlreadyInRoom = getRoomsArray().find((room) => room.roomUsers.some((user) => user.index === userId))

  if(isUserAlreadyInRoom) {
    return getRoomsArray();
  }
  const roomId = randomUUID();
  const newRoomData = {
    roomId,
    roomUsers: []
  }
  rooms[roomId] = newRoomData;
  updateRooms(roomId, userId);
  return getRoomsArray();
}

export const getUserRooms = (userId: UUID) => {
  return getRoomsArray().filter((room) => room.roomUsers
    .some(user => user.index === userId))
    .map((room) => room.roomId);
}

export const updateRooms = (roomId: UUID, userId: UUID): Room[] => {
  const room = rooms[roomId];
  if(
    room.roomUsers.length === 1 &&
    room.roomUsers[0].index === userId
  ) {
    return getRoomsArray();
  }

  room.roomUsers.push({
    name: getUserfromUserDB(userId).name,
    index: userId,
  })

  return getRoomsArray();
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

  return getRoomsArray();
}

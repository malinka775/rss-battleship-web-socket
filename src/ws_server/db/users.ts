import { UUID, randomUUID } from "node:crypto";
import { User } from "../interfaces";
import { getRoomsArray, Room } from "./rooms";

const users : {[key: UUID]: User} = {};

let winners: Winner[] = [];

interface Winner {
  name: string,
  wins: number,
}

interface UserRegResponse {
  name: string;
  index: UUID;
  error: boolean;
  errorText: string;
}

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
    roomData: getRoomsArray(),
  }
}

export const getUserfromUserDB = (userId: UUID) => {
  return users[userId]
}

export const getWinners = (): Winner[] => {
  const usersCopy = JSON.parse(JSON.stringify(users)) as {[key: UUID]: User};
  winners = Object.values(usersCopy).filter(user => !!user.wins).map(({name, wins}) => ({name, wins})) as Winner[];
  winners.sort((w1, w2) => w2.wins - w1.wins)

  return winners;
}

export const incrementUserWins = (id: UUID) => {
  if (!users[id].wins) {
    users[id].wins = 1;
  } else {
    users[id].wins = users[id].wins + 1;
  }
}

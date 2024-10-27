export enum ClientMessageTypes {
  REG_USER = 'reg',
  ADD_USER_TO_ROOM = 'add_user_to_room',
  TURN = 'turn',
  ATTACK = 'attack',
  CREATE_ROOM = 'create_room',
  UPD_ROOM = 'update_room',
  UPD_WINNERS = 'update_winners',
  ADD_SHIPS = 'add_ships',
}

export enum ServerMessageTypes {
  REG_USER = 'reg',
  ADD_SHIPS = 'add_ships',
  ATTACK = 'attack',
  RANDOM_ATTACK = 'randomAttack',
  UPD_WINNERS = 'update_winners',
  UPD_ROOM = 'update_room',
  CREATE_GAME = 'create_game',
  START_GAME = 'start_game',
  TURN = 'turn',
  FINISH_GAME = 'finish',
}

export interface ClientMessage {
  type: string,
  data: any,
  id: number,
}

export interface User {
  name: string,
  password: string,
  wins?: number,
}

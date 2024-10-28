# RSSchool NodeJS websocket task template
> Static http server and base task packages. 
> By default WebSocket client tries to connect to the 3000 port.

## Installation
1. Clone/download repo
2. `npm install`

## Usage
**Development**

`npm run start:dev`

* App served @ `http://localhost:8181` with nodemon
* Websocket server served @ `http://localhost:3000` with nodemon
* Ports for servers could be defined in .env file (you can copy contents of .env.example)

`npm run start`

* App served @ `http://localhost:8181` without nodemon
* Websocket server served @ `http://localhost:3000` without nodemon
* Ports for servers could be defined in .env file (you can copy contents of .env.example)

---

**All commands**

Command | Description
--- | ---
`npm run start:dev` | App served @ `http://localhost:8181`, Websocket server served @ `http://localhost:3000` with nodemon
`npm run start` | App served @ `http://localhost:8181`, Websocket server served @ `http://localhost:3000` without nodemon

**Note**: Ports for servers could be defined in .env file (you can copy contents of .env.example)

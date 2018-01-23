const io = require('socket.io')();
const redis = require('redis');
const redisClient = redis.createClient({
    // prefix: 'draw-'
});

let lines_buffer = [];
let rightGuess = '';

let words = [
    'panda',
    'panda',
    'panda',
]

rightGuess = arrayRand(words);
console.log(rightGuess);     
const maxPlayerPerRoom = 2;

io.on('connection', client => {
    client.on('find_game', (user) => {
        console.log('looking for game');
        findGame(client, user);
    })
    client.on('join_game', (gameId) => {
        redisClient.hgetall('draw-rooms:' + gameId, (err, game) => {
            game.players = JSON.parse(game.players);
            const players = [];
            Promise.all(game.players.map(player => {
                return new Promise((resolve, reject) => {
                    redisClient.hgetall('draw-users:' + player, (err, user) => {
                        if (err) {
                            return reject(err);
                        }
                        players.push(user);
                        resolve();
                    });
                });
            })).then(() => {
                client.join(gameId);
                game.players = players;
                client.emit('game_info', game);
            });
        });
    });
    client.on('get_current_lines', (gameId) => {
        // client.emit('current_lines', {lines: lines_buffer});

        redisClient.lrange('draw-line-history:' + gameId, 0, -1, (err, lines) => {
            lines = lines.map(JSON.parse);
            client.emit('current_lines', {lines: lines});
        })
    });
    client.on('get_current_chat', (gameId) => {
        redisClient.smembers('draw-chat:' + gameId, (err, messages) => {
            messages = messages.map(JSON.parse);
            client.emit('current_chat', messages)
        })
    })
    console.log('connected');
    client.on('new_line', ({ line, gameId }) => {
        console.log(line);
        lines_buffer.push(line);
        redisClient.sadd('draw-line-history:' + gameId, JSON.stringify(line));
        client.broadcast.emit('draw', line);
    });

    client.on('new_lines', ({ lines, gameId }) => {
        lines_buffer.push(...lines);
        lines.forEach((line) => {
            redisClient.rpush('draw-line-history:' + gameId, JSON.stringify(line));
        })
        client.broadcast.to(gameId).emit('draw', lines);
    });

    client.on('clear', () => {
        lines_buffer = [];
        client.broadcast.emit('clear_canvas');
    });
    client.on('new_message', ({content, gameId, userId}) => {
        if (content.toLowerCase() === rightGuess) {
            rightGuess = arrayRand(words);
            client.broadcast.emit('game_over', {});
            client.emit('game_over');
            lines_buffer = [];
        }
        redisClient.hgetall('draw-users:' + userId, (err, user) => {
            if (user === null) return;
            const message = {content: content, userName: user.name, userId: user.id};
            redisClient.sadd('draw-chat:' + gameId, JSON.stringify(message));
            client.emit('message', message);
            client.broadcast.to(gameId).emit('message', message);
        });
    });
    client.on('register', ({name}) => {
        const id = createId();
        redisClient.hmset('draw-users:' + id, "id", id, "name", name);
        client.emit('registration_infos', {name, id});
    })
});

io.listen('8000');

function createId() {
    return strRand(10);
}

function strRand(size) {
    const chars = 'azertyuiopqsdfghjklmwxcvbnAZERTYUIOPQSDFGHJKLMWXCVBN0123456789';
    const charsSize = chars.length;
    res = '';
    for (let i = 0; i < size; i++) {
        res += chars[Math.floor(Math.random() * charsSize)];
    }
    return res;
}

function arrayRand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function findGame(client, user) {
    redisClient.smembers('draw-available-rooms', (err, rooms) => {
        if (rooms.length > 0) {
            console.log("found : " + rooms[0]);
            redisClient.hgetall('draw-rooms:' + rooms[0], (err, game) => {
                game.players = JSON.parse(game.players);
                console.log(game.players);
                game.players.push(user.id);
                console.log(game.players);
                redisClient.hset('draw-rooms:' + game.id, "players", JSON.stringify(game.players))
                if (game.players.length >= maxPlayerPerRoom) {
                    redisClient.srem('draw-available-rooms', rooms[0]);
                }
                client.join(game.id);                
                client.emit('game_found', game);          
            })
        } else {
            console.log('create');
            const id = createId();
            const game = { id, players: [ user.id ] };
            console.log(game);
            redisClient.sadd('draw-available-rooms', game.id);
            redisClient.hmset(
                'draw-rooms:' + game.id, 
                "id", game.id, 
                "players", JSON.stringify(game.players)
            );
            client.join(game.id)     
            client.emit('game_found', game);
        }
    })
}

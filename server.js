const io = require('socket.io')();
const redis = require('redis');
const client = redis.createClient({
    prefix: 'draw-'
});
const { promisify } = require('util');
const get = promisify(client.get).bind(client);

let lines_buffer = [];
let messages_buffer = [];
let rightGuess = '';

let words = [
    'panda',
    'beer',
    'test',
    'test2',
    'test3',
    'test4'
]

client.set('test', 'blabla');
get('test').then(b => console.log(b));

function arrayRand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

rightGuess = arrayRand(words);
console.log(rightGuess);        

io.on('connection', client => {
    client.emit('init_chat', messages_buffer)
    client.on('get_current_lines', () => {
        client.emit('current_lines', {lines: lines_buffer});
    });
    client.on('get_current_chat', () => {
        client.emit('current_chat', messages_buffer)
    })
    console.log('connected');
    client.on('new_line', line => {
        lines_buffer.push(line);
        client.broadcast.emit('draw', line);
        console.log(line);
    });

    client.on('new_lines', lines => {
        lines_buffer.push(...lines);
        client.broadcast.emit('draw', lines);
        console.log(lines);
    });

    client.on('clear', () => {
        lines_buffer = [];
        client.broadcast.emit('clear_canvas');
    });
    client.on('new_message', message => {
        if (message.toLowerCase() === rightGuess) {
            rightGuess = arrayRand(words);
            console.log(rightGuess);        
            client.broadcast.emit('game_over', {});
        }
        if (messages_buffer.length >= 10)
            messages_buffer.shift();
        messages_buffer.push(message);
        client.emit('message', message);
        client.broadcast.emit('message', message);
    });
    client.on('register', ({name}) => {
        id = createId();
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

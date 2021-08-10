const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const app = express()
const server = http.createServer(app)
const io = socketio(server)
const {generateMessage, generateLocationMessage} = require('./utils/messages')
const {addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const port = process.env.PORT || 8081

const publicDirectoryPath = path.join(__dirname, '../public')

//setup directory serve
app.use(express.static(publicDirectoryPath))

let count = 0;

// server( emit ) -> client ( receive ) - countUpdated
// client( emit ) -> server( receive ) - increment

io.on('connection', (socket) => {
    socket.on('join', ({username, room}, callback) => {
        const {error, user} = addUser({
            id: socket.id,
            username,
            room
        })
        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('Admin','Welcome')) //to that particular connection
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin',`${user.username} has joined!`)) // emits to all the clients beside the current one from the current room
        io.to(user.room).emit('roomData',{
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed') //acknowledge the event - let the client know that the message was delivered
        }

        const user = getUser(socket.id)
        io.to(user.room).emit('message', generateMessage(user.username, message)) // emits to all the clients
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username,`https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin',`${user.username} has left!!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`server is up on port ${port}`);
})

const express = require('express')
const session = require('express-session')
const handlebars = require('express-handlebars')
const app = express()
const http = require('http')
const server = http.Server(app)
const io = require('socket.io')(server)
const normalize = require('normalizr').normalize
const schema = require('normalizr').schema
const productos = require('./api/productos')
const Mensajes = require('./api/mensajes')

require('./database/connection')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static('public'))

const MongoStore = require('connect-mongo')
const advancedOptions = {useNewUrlParser: true, useUnifiedTopology: true}

app.use((err, req, res, next) =>{
    console.error(err.message)
    return res.status(500).send('Algo se rompió!!')
})

app.engine('hbs', handlebars({
    extname: '.hbs',
    defaultLayout: 'index.hbs',
    layoutsDir: __dirname + '/views/layouts'
}))

app.set("view engine", "hbs")
app.set("views", "./views")

app.use(session({
    store: MongoStore.create({
        mongoUrl: 'mongodb+srv://juliankim:coderhouse@cluster0.jiary.mongodb.net/myFirstDatabase?retryWrites=true&w=majority',
        mongoOptions: advancedOptions
    }),
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 600000
    }
}))

app.get('/login', (req, res) => {
    if (!req.session.user) {
        res.render('vista', { showLogin: true, showContent: false, showBienvenida: false });
    } else {
        res.render('vista', { showLogin: false, showContent: true, bienvenida: req.session.user, showBienvenida: true });
    }
})

app.post('/login', (req, res) => {
    if (!req.body.username) {
        res.send('Login falló');
    }
    else {
        req.session.user = req.body.username
        res.render('vista', { showLogin: false, showContent: true, bienvenida: req.session.user, showBienvenida: true  });
    }
})

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (!err) res.sendFile(__dirname + '/public/logout.html')
        else res.send(
            { status: 'Logout ERROR', body: err })
    })
})

const productosRouter = require('./routes/productosRouter')
app.use('/api', productosRouter)
const mensajesRouter = require('./routes/mensajesRouter')
app.use('/api', mensajesRouter)

io.on('connection', async socket => {
    console.log('Usuario conectado')

    socket.on('nuevo-producto', nuevoProducto => {
        console.log(nuevoProducto)
        productos.guardar(nuevoProducto)
    })
    socket.emit('guardar-productos', () => {
        socket.on('notificacion', data => {
            console.log(data)
        })
    })

    socket.on("new-message", async function (data) {

        await Mensajes.guardar(data)

        let mensajesDB = await Mensajes.buscarTodo()     

        const autorSchema = new schema.Entity('autor', {}, { idAttribute: 'nombre' });

        const mensajeSchema = new schema.Entity('texto', {
            autor: autorSchema
        }, { idAttribute: '_id' })

        const mensajesSchema = new schema.Entity('mensajes', {
            msjs: [mensajeSchema]
        }, {idAttribute: 'id'})

        const mensajesNormalizados = normalize(mensajesDB, mensajesSchema)
        const messages = []
        messages.push(mensajesDB);

        console.log(mensajesDB)

        console.log(mensajesNormalizados)
            
        io.sockets.emit("messages", mensajesNormalizados)
    })
})

const PORT = 8080

const svr = server.listen(PORT, () => {
    console.log(`servidor escuchando en http://localhost:${PORT}`)
})

server.on('error', error => {
    console.log('error en el servidor:', error)
})
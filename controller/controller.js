const knex = require('../DB/db.js');
let express = require('express');
let router = express.Router();

const bcrypt = require('bcrypt')
const uuid = require('uuid')
const mailService = require('../service/mail-service')
const tokenService = require('../service/token-service')

const userDTO = require('../dtos/user-dto')

const ApiError = require('../exeptions/api-error')

const {body, validationResult} = require('express-validator')

const authMiddleware = require('../middlewares/auth-middleware')

//all-user-routes

router.get("/products", async (req, res) => {
    const products = await knex.withSchema("public")
        .select('*')
        .from('products')
        .leftJoin('categories', 'products.category', 'categories.id')
        .leftJoin('prices', 'products.id', 'prices.product_id')


    res.send(products)
});

//authorization-routes

router.post(
    '/registration',

    async (req, res, next) => {

        const users = await knex
        .select('Email', 'Login')
        .from('Users')

    try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequest('Ошибка при валидации', errors.array()))
            }

            const hasDuplicates = await users.some(function(currentObject) {
                const email = currentObject.Email.toLowerCase() === req.body.email;
                const login = currentObject.Login.toLowerCase() === req.body.login;
                return email || login;

            });

            if (hasDuplicates) {
                throw ApiError.BadRequest(`Пользователь уже зарегестрирован`)
            }

            const hashPassword = await bcrypt.hash(req.body.password, 3)
            const activationLink = uuid.v4();

            await knex('Users').insert(
                {
                    Login: req.body.login,
                    Password: hashPassword,
                    FIO: req.body.fio,
                    Email: req.body.email,
                    ActivationLink: activationLink
                }
            )

            await mailService.sendActivationMail(req.body.email, `${process.env.API_URL}/api/activate/${activationLink}`)

            const currentUser = await knex
                .select('*')
                .from('Users')
                .where('Login', req.body.login)

            const userdto = new userDTO(currentUser[0])
            const tokens = tokenService.generateTokens({...userdto})
            await tokenService.saveToken(userdto.UserID, tokens.refreshToken)

            res.cookie('refreshToken', tokens.refreshToken, {maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true})
            res.send({...tokens, user: userdto})
    } catch (e) {
        next(e)
    }
})
router.post('/login', async (req, res, next) => {
    try {
        const user = await knex
            .select('*')
            .from('Users')
            .where('Email', req.body.email)

        if (!user[0]) {
            throw ApiError.BadRequest('Пользователь с такой эл. почтой не найден')
        }

        const isPassEquals = await bcrypt.compare(req.body.password, user[0].Password)
        if (!isPassEquals) {
            throw ApiError.BadRequest('Неверный пароль')
        }

        const userdto = new userDTO(user[0])
        const tokens = tokenService.generateTokens({...userdto})
        await tokenService.saveToken(userdto.UserID, tokens.refreshToken)

        res.cookie('refreshToken', tokens.refreshToken, {maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true})
        res.send({...tokens, user: userdto})
    } catch (e) {
        next(e)
    }
})
router.post('/logout', async (req, res, next) => {
    try {
        const {refreshToken} = req.cookies;
        await tokenService.removeToken(refreshToken)
        res.clearCookie('refreshToken');
        return res.send('Логаут успешен')
    } catch (e) {
        next(e)
    }
})
router.get('/activate/:link', async (req, res, next) => {
    try {
        const user = await knex
            .select('activation_link')
            .from('users')
            .where('activation_link', req.params.link)

        if (!user) {
            throw ApiError.BadRequest('Неккоректная ссылка активации')
        }

        await knex
            .select('activated')
            .from('users')
            .where('activation_link', req.params.link)
            .update('activated', true)

        return res.redirect(process.env.CLIENT_URL)
    } catch (e) {
        next(e)
    }
})
router.get('/refresh', async (req, res, next) => {
    try {
        const {refreshToken} = req.cookies;

        if (!refreshToken) {
            throw ApiError.UnauthorizedError()
        }

        const userData = tokenService.validateRefreshToken(refreshToken);
        const tokenFromDB = await tokenService.findToken(refreshToken)
        if (!userData || !tokenFromDB) {
            throw ApiError.UnauthorizedError()
        }

        console.log(userData)
        const user = await knex
            .select('*')
            .from('Users')
            .where('UserID', userData.UserID)

        const userdto = new userDTO(user[0])
        const tokens = tokenService.generateTokens({...userdto})
        await tokenService.saveToken(userdto.UserID, tokens.refreshToken)

        res.cookie('refreshToken', tokens.refreshToken, {maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true})
        res.send({...tokens, user: userdto})
    } catch (e) {
        next(e)
    }
})

//test-endpoints

router.get('/users', authMiddleware, async (req, res, next) => {
    try {
        const users = await knex
            .select('*')
            .from('Users')

        res.send(users)
    } catch (e) {
        next(e)
    }

})

//cart-endpoints

router.post('/cart', authMiddleware, async (req, res, next) => {
    try {
        const cart = await knex
            .select('*')
            .from('cart')
            .where('user_id', req.body.id)

        if (!cart[0])
            await knex('cart').insert({user_id: req.body.id})

        res.send(cart)
    } catch (e) {
        next(e)
    }
})

module.exports = router;

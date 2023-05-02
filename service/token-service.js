const knex = require('../DB/db.js');
const jwt = require('jsonwebtoken')

class TokenService {
    generateTokens(payload) {
        const accessToken = jwt.sign(payload, 'super-mega-key', {expiresIn: '60m'})
        const refreshToken = jwt.sign(payload, 'second-super-mega-key', {expiresIn: '30d'})

        return {
            accessToken,
            refreshToken
        }
    }

    async saveToken(userId, refreshToken) {
        const tokens = await knex
            .select('*')
            .from('Users')
            .joinRaw('left join user_tokens as token ON token.user_id = "Users"."UserID"', [])
            .where('user_id', userId)

        await tokens.some(async function(currentObject) {
            if (currentObject.token !== 0 || currentObject.token !== undefined || currentObject.token !== '') {
                await knex
                    .select('*')
                    .from('user_tokens')
                    .where('user_id', userId)
                    .update('token', refreshToken)
                return null;
            }
        });

        await knex('user_tokens').insert(
            {
                user_id: userId,
                token: refreshToken
            }
        )
    }

    validateAccessToken(token) {
        try {
            const userData = jwt.verify(token, 'super-mega-key')
            return userData
        } catch (e) {
            return null;
        }
    }

    validateRefreshToken(token) {
        try {
            const userData = jwt.verify(token, 'second-super-mega-key')
            return userData
        } catch (e) {
            return null;
        }
    }

    async removeToken(refreshToken) {
        const tokenData = await knex
            .select('*')
            .from('user_tokens')
            .where('token', refreshToken)
            .del()

        return tokenData
    }

    async findToken(refreshToken) {
        const tokenData = await knex
            .select('token')
            .from('user_tokens')
            .where('token', refreshToken)

        return tokenData
    }
}

module.exports = new TokenService()

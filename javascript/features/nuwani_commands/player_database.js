// Copyright 2020 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

import { sha1 } from 'features/nuwani_commands/sha1.js';

// Query to update a player's (hashed) password to the given hashed value and salt.
const CHANGE_PASSWORD_QUERY = `
    UPDATE
        users
    SET
        password = ?,
        password_salt = ?
    WHERE
        user_id = (
            SELECT
                user_id
            FROM
                users_nickname
            WHERE
                nickname = ?)
    LIMIT
        1`;

// Query to retrieve the necessary information to display a player summary message.
const PLAYER_SUMMARY_QUERY = `
    SELECT
        users.level,
        users.is_vip,
        users_mutable.online_time,
        users_mutable.kill_count,
        users_mutable.death_count,
        IFNULL(TIMESTAMPDIFF(SECOND, users_mutable.last_seen, NOW()), 0) as last_seen
    FROM
        users_nickname
    LEFT JOIN
        users ON users.user_id = users_nickname.user_id
    LEFT JOIN
        users_mutable ON users_mutable.user_id = users_nickname.user_id
    WHERE
        users_nickname.nickname = ?`;

// Enables interacting with the MySQL database for purposes of the PlayerCommands provided by the
// Nuwani IRC system. Requires a live MySQL connection.
export class PlayerDatabase {
    static kTypeNumber = 0;
    static kTypeString = 1;
    static kTypeCustom = 2;

    passwordSalt_ = null;

    constructor(passwordSalt) {
        this.passwordSalt_ = passwordSalt;
    }

    // Retrieves portions of the player information for the given |nickname| from the database that
    // will be used for outputting their information on IRC.
    async getPlayerSummaryInfo(nickname) {
        const results = await server.database.query(PLAYER_SUMMARY_QUERY, nickname);
        return results.rows.length ? results.rows[0]
                                   : null;
    }

    // Returns which fields are supported by the !supported, !getvalue and !setvalue commands. This
    // is a hardcoded list because we only want to support a sub-set of the database column data.
    getSupportedFields() {
        return {
            clock_tz: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            clock: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            custom_color: { table: 'users_mutable', type: PlayerDatabase.kTypeCustom },
            death_count: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            death_message: { table: 'users_mutable', type: PlayerDatabase.kTypeString },
            is_developer: { table: 'users', type: PlayerDatabase.kTypeNumber },
            is_vip: { table: 'users', type: PlayerDatabase.kTypeNumber },
            jailed: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            kill_count: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            last_ip: { table: 'users_mutable', type: PlayerDatabase.kTypeCustom },
            last_seen: { table: 'users_mutable', type: PlayerDatabase.kTypeCustom },
            level: { table: 'users', type: PlayerDatabase.kTypeCustom },
            money_bank_type: { table: 'users_mutable', type: PlayerDatabase.kTypeCustom },
            money_bank: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            money_bounty: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            money_cash: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            money_debt: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            money_spawn: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            online_time: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            preferred_radio_channel: { table: 'users_mutable', type: PlayerDatabase.kTypeString },
            skin_id: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            stats_carbombs: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            stats_drivebys: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            stats_exports: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            stats_fc_deaths: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            stats_fc_kills: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            stats_heli_kills: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            stats_minigame: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            stats_packages: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            stats_reaction: { table: 'users_mutable', type: PlayerDatabase.kTypeNumber },
            validated: { table: 'users', type: PlayerDatabase.kTypeNumber },
        };
    }

    // Returns whether the PlayerDatabase has the ability to update player passwords.
    canUpdatePasswords() {
        return !!this.passwordSalt_;
    }

    // Changes the password of the |nickname| to |temporaryPassword|. A new database salt will be
    // generated as well, leading to a completely new value.
    async changePassword(nickname, temporaryPassword) {
        if (!this.canUpdatePasswords())
            throw new Error('The `passwordSalt` configuration option is required for this.');

        const databaseSalt = this.generateDatabaseSalt();
        const hashedPassword = sha1(`${databaseSalt}${temporaryPassword}${this.passwordSalt_}`);

        return this._changePasswordQuery(nickname, hashedPassword, databaseSalt);
    }

    // Actually changes the password for the given |nickname| to |password|, a hashed value so that
    // the actual password doesn't have to leave the server's JavaScript code.
    async _changePasswordQuery(nickname, password, databaseSalt) {
        const results =
            await server.database.query(CHANGE_PASSWORD_QUERY, password, databaseSalt, nickname);
        
        return results.affectedRows > 0;
    }

    // Gets the given |fieldName| from the |nickname|'s data in the database. Custom fields will be
    // pre-processed before being returned.
    async getPlayerField(nickname, fieldName) {
        const fields = this.getSupportedFields();

        if (!fields.hasOwnProperty(fieldName))
            throw new Error(`${fieldName} is not a field known to me. Please check !supported.`);
        
        const field = fields[fieldName];
        const result = await this._getPlayerFieldQuery(nickname, fieldName, field);

        if (result === null)
            throw new Error(`The player ${nickname} could not be found in the database.`);
        
        // TODO: Apply custom formatting if the |field| requires it.

        return result;
    }

    // Actually runs a database query for getting the |field| from the |nickname|'s player data. The
    // |field| includes the table name that |fieldName| exists in. Both values are safe to use
    // directly, but |nickname| will potentially have to be filtered.
    async _getPlayerFieldQuery(nickname, fieldName, field) {
        const query = `
            SELECT
                ${fieldName}
            FROM
                ${field.table}
            WHERE
                user_id = (
                    SELECT
                        user_id
                    FROM
                        users_nicknames
                    WHERE
                        nickname = ?)`;
        
        const result = await server.database.query(query, nickname);
        if (!result.rows.length || !result.rows[0].hasOwnProperty(fieldName))
            return null;

        return result.rows[0][fieldName];
    }

    // Returns the |value| formatted in a way that's appropriate for the given |fieldName|. Updating
    // the value should take this format too, so when making any changes here be sure to also
    // update the `_updateCustomPlayerField` method in this class.
    formatCustomPlayerField(fieldName, value) {
        // custom_color
        // level
        // money_bank_type
        // last_ip
        // last_seen
    }

    // Updates the |fieldName| setting of the given |nickname| to the set |value|. Validation will
    // be applied based on the type of field.
    async updatePlayerField(nickname, fieldName, value) {
        const fields = this.getSupportedFields();

        if (!fields.hasOwnProperty(fieldName))
            throw new Error(`${fieldName} is not a field known to me. Please check !supported.`);
        
        const field = fields[fieldName];
        switch (field.type) {
            case PlayerDatabase.kTypeNumber:
                return this._updateNumericPlayerField(nickname, field.table, fieldName, value);
            case PlayerDatabase.kTypeString:
                return this._updateStringPlayerField(nickname, field.table, fieldName, value);
            case PlayerDatabase.kTypeCustom:
                return this._updateCustomPlayerField(nickname, field.table, fieldName, value);
            default:
                throw new Error(`${fieldName} has an invalid type defined in the code.`);
        }
    }

    // Generates a new random database salt, which is an integer between 100000000 and 999999999.
    generateDatabaseSalt() {
        return Math.floor(Math.random() * (999999999 - 100000000)) + 100000000;
    }

    // Updates the |field| setting of the given |nickname|, which is one of the custom values.
    // Validation and formatting specific to the |column| will be done in here.
    async _updateCustomPlayerField(nickname, table, column, value) {
        // custom_color
        // level
        // money_bank_type
        // last_ip
        // last_seen

        throw new Error('Not implemented.');
    }

    // Updates the numeric |column| setting of the given |nickname|.
    async _updateNumericPlayerField(nickname, table, column, value) {
        const numericValue = parseInt(value, 10);
        if (numericValue <= -2147483648 || numericValue >= 2147483647)
            throw new Error('Numeric values must be between -2147483647 and 2147483646.');
        
        return this._updatePlayerFieldQuery(nickname, table, column, numericValue);
    }

    // Updates the textual |column| setting of the given |nickname|.
    async _updateStringPlayerField(nickname, table, column, value) {
        const stringValue = String(value);
        if (stringValue.length >= 64)
            throw new Error('Textual values must not be longer than 64 characters in length.');
        
        return this._updatePlayerFieldQuery(nickname, table, column, value);
    }

    // Actually updates the |column| in |table| to |value| for the given |nickname|. At this point
    // the |value| must have been normalized already, but it's still not trusted.
    async _updatePlayerFieldQuery(nickname, table, column, value) {
        const query = `
            UPDATE
                ${table}
            SET
                ${column} = ?
            WHERE
                user_id = (
                    SELECT
                        user_id
                    FROM
                        users_nicknames
                    WHERE
                        nickname = ?)
            LIMIT
                1`;

        const results = await server.database.query(query, value, nickname);
        if (!results || !results.affectedRows)
            throw new Error(`The player ${nickname} could not be found in the database.`);

        return value;
        
    }
}

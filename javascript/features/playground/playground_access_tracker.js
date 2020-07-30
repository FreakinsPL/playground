// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

// The number of minutes for which exceptions will be cached in case a player reconnects.
const ExceptionReconnectTimeoutMs = 5 /* minutes */ * 60 * 1000;

// The PlaygroundAccessTracker tracks who can access a command. Most of the special commands are
// tied to a specific player level, which can be lowered by Management. In addition, players who
// have access to a command due to their level (not due to temporary assignment) can grant access
// to the command to other players as well, for the duration of the session.
//
// Basic protection has been built in for people timing out and having to reconnect: their access
// exceptions will be remembered for up to a few minutes.
class PlaygroundAccessTracker {
    constructor() {
        this.commandLevelDefaults_ = new Map();
        this.commandLevels_ = new Map();

        this.exceptions_ = new Map();

        this.cachedExceptions_ = new Map();
        this.cachedExceptionsToken_ = new Map();

        this.userIds_ = new WeakMap();

        server.playerManager.addObserver(this);
    }

    // Gets an iterator for the tracked commands mapped to their current level values.
    get commands() { return this.commandLevels_.entries(); }

    // Returns whether the |player| is allowed to access the |command|.
    canAccessCommand(command, player) {
        let commandLevel = this.commandLevels_.get(command);
        if (commandLevel === undefined)
            commandLevel = Player.LEVEL_ADMINISTRATOR;  // xxx

        if (player.level >= commandLevel)
            return true;

        const exceptions = this.exceptions_.get(player);
        if (!exceptions)
            return false;

        return exceptions.has(command);
    }

    // Registers |command| that can be executed by players of |defaultLevel|.
    registerCommand(command, defaultLevel) {
        this.commandLevelDefaults_.set(command, defaultLevel);
        this.commandLevels_.set(command, defaultLevel);
    }

    // Removes |command| from the list of commands controlled by this access tracker.
    unregisterCommand(command) {
        this.commandLevelDefaults_.delete(command);
        this.commandLevels_.delete(command);

        for (const exceptions of this.exceptions_.values())
            exceptions.delete(command);
    }

    // Gets the player level required to execute |command|. Throws when |command| does not exist.
    getCommandLevel(command) {
        const level = this.commandLevels_.get(command);
        if (level === undefined)
            throw new Error('Invalid command given: ' + command);

        return level;
    }

    // Gets the default command level with which |command| was registered.
    getDefaultCommandLevel(command) {
        const level = this.commandLevelDefaults_.get(command);
        if (level === undefined)
            throw new Error('Invalid command given: ' + command);

        return level;
    }

    // Sets the player level required to execute |command|. Exceptions, even those for players who
    // may now use |command| based on their level, will remain.
    setCommandLevel(command, level) {
        if (!this.commandLevels_.has(command))
            throw new Error('Invalid command given: ' + command);

        this.commandLevels_.set(command, level);
    }

    // Adds an exception that allows |player| to use the |command|. |player| must be registered. If
    // |sourcePlayer| is set, an announcement will be send to the |player|.
    addException(command, player, sourcePlayer = null) {
        if (!player.account.isRegistered())
            throw new Error('Player ' + player.name + ' (Id:' + player.id + ') is not registered.');

        let exceptions = this.exceptions_.get(player);
        if (!exceptions) {
            exceptions = new Set();

            // Store the Set for later usage. This will persist until their disconnection.
            this.exceptions_.set(player, exceptions);
        }

        exceptions.add(command);

        if (sourcePlayer) {
            player.sendMessage(Message.LVP_CMD_EXCEPTION_GRANTED, sourcePlayer.name,
                               sourcePlayer.id, command);
        }
    }

    // Returns the number of exceptions that have been granted for |command|. This method has a
    // theoretical worst-case of O(n) on the number of connected players.
    getExceptionCount(command) {
        return this.getExceptions(command).length;
    }

    // Returns the players for whom an exception has been granted for |command|.  This method has a
    // theoretical worst-case of O(n) on the number of connected players.
    getExceptions(command) {
        let players = [];
        this.exceptions_.forEach((exceptions, player) => {
            if (exceptions.has(command))
                players.push(player);
        });

        return players;
    }

    // Returns whether |player| has an exception allowing them to use |command|.
    hasException(command, player) {
        if (!player.account.isRegistered())
            return false;  // unregistered players cannot have exceptions.

        const exceptions = this.exceptions_.get(player);
        if (!exceptions)
            return false;

        return exceptions.has(command);
    }

    // Removes the exception that allows |player| to use |command|. If |sourcePlayer| is set, an
    // announcement will be send to the |player|.
    removeException(command, player, sourcePlayer = null) {
        if (!player.account.isRegistered())
            throw new Error('Player ' + player.name + ' (Id:' + player.id + ') is not registered.');

        const exceptions = this.exceptions_.get(player);
        if (!exceptions)
            return;

        exceptions.delete(command);

        if (sourcePlayer) {
            player.sendMessage(Message.LVP_CMD_EXCEPTION_REVOKED, sourcePlayer.name,
                               sourcePlayer.id, command);
        }
    }

    // Called when |player| has logged in to their account. Exceptions granted to them in a session
    // no longer than a few minutes ago will be restored.
    onPlayerLogin(player) {
        const userId = player.account.userId;
        this.userIds_.set(player, userId);

        const cachedExceptions = this.cachedExceptions_.get(userId);
        if (!cachedExceptions)
            return;

        this.exceptions_.set(player, cachedExceptions);

        this.cachedExceptions_.delete(userId);
        this.cachedExceptionsToken_.delete(userId);

        player.sendMessage(Message.LVP_CMD_EXCEPTION_RESTORED, cachedExceptions.size);
    }

    // Called when |player| disconnects from the server.
    onPlayerDisconnect(player) {
        const exceptions = this.exceptions_.get(player);
        if (!exceptions)
            return;

        this.exceptions_.delete(player);

        if (!exceptions.size)
            return;

        const userId = this.userIds_.get(player);
        this.userIds_.delete(player);

        // Use a random token to avoid issues with players who rapidly reconnect multiple times.
        const token = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

        this.cachedExceptions_.set(userId, exceptions);
        this.cachedExceptionsToken_.set(userId, token);

        wait(ExceptionReconnectTimeoutMs).then(() => {
            const readToken = this.cachedExceptionsToken_.get(userId);
            if (readToken !== token)
                return;

            this.cachedExceptions_.delete(userId);
            this.cachedExceptionsToken_.delete(userId);
        });
    }

    dispose() {
        server.playerManager.removeObserver(this);

        this.cachedExceptions_.clear();

        this.commandLevelDefaults_.clear();
        this.commandLevels_.clear();

        this.exceptions_.clear();
    }
}

export default PlaygroundAccessTracker;

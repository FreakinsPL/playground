// Copyright 2020 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

import { GameRegistration } from 'features/games/game_registration.js';

// The game manager is responsible for keeping track of and managing all active games on the server-
// whether that be accepting sign-ups, or actually in progress.
export class GameManager {
    // Map of |player| => GameActivity instances of a player's current activity, if any.
    activity_ = new WeakMap();

    // Set of GameRegistration instances that are currently accepting registrations.
    registrations_ = new Set();

    // ---------------------------------------------------------------------------------------------

    // Returns the activity the |player| is engaged in as a `GameActivity` instance, if any.
    getPlayerActivity(player) { return this.activity_.get(player) || null; }

    // ---------------------------------------------------------------------------------------------

    // Starts registration for a new game of the given |description|. No announcements will be sent,
    // that's the job of whoever requested the game to be created. Will return the GameRegistration
    // instance when the request was successful, or NULL otherwise.
    createGameRegistration(description, type) {
        const registration = new GameRegistration(description, type, this);

        this.registrations_.add(registration);
        return registration;
    }

    // Returns an array with the pending games for the game described by |description|. Some will be
    // invite-only, while others will be available for anyone to participate in.
    getPendingGameRegistrations(description) {
        let registrationsForGame = [];

        for (const registration of this.registrations_) {
            if (registration.description === description)
                registrationsForGame.push(registration);
        }

        return registrationsForGame;
    }

    // Starts the game described by |description| based on the given |registration| information, but
    // only if the minimum requirements for the game have been met.
    startGame(registration, description) {
        // TODO
    }

    // Immediately stops all games that are either accepting sign-ups or in-progress because the
    // game described by |description| will no longer be available.
    stopAllActiveGames(description) {
        // TODO
    }
    
    // ---------------------------------------------------------------------------------------------

    // Called when the given |player| has registered to participate in the |registration|.
    onPlayerAddedToRegistration(player, registration) {
        this.activity_.set(player, registration);
    }

    // Called when the given |player| has dropped out of the given |registration|.
    onPlayerRemovedFromRegistration(player, registration) {
        this.activity_.delete(player);
    }

    // ---------------------------------------------------------------------------------------------

    dispose() {}
}

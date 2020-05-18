// Copyright 2020 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

import { GameActivity } from 'features/games/game_activity.js';

// Duration, in seconds, for which a game registration will wait.
export const kDurationSeconds = 20;

// Encapsulates the state in a game where registrations are being accepted and tracked. Will let
// the manager know when the registration process has finished.
export class GameRegistration extends GameActivity {
    // Type of registration this instance encapsulates.
    static kTypePublic = 0;
    static kTypeRestricted = 1;

    manager_ = null;

    description_ = null;
    type_ = null;

    players_ = null;

    // Gets the description of the game that this registration has been created for.
    get description() { return this.description_; }

    // Gets the duration, in seconds, for which this registration will wait.
    get duration() { return kDurationSeconds; }

    // Gets the type of registration this instance deals with. One of the aforementioned statics.
    get type() { return this.type_; }

    constructor(description, type, manager) {
        super();

        this.manager_ = manager;

        this.description_ = description;
        this.type_ = type;

        this.players_ = new Set();
    }

    // Registers the |player| to participate in the game this registration's for. Request for the
    // game to start if the maximum number of participants has been reached.
    registerPlayer(player) {
        this.manager_.onPlayerAddedToRegistration(player, this);
        this.players_.add(player);

        // TODO: Check if the maximum number of players has been reached.
    }

    // Removes the |player| from the list of people registered to participate in this game. If there
    // are no more participants left, the game can be disposed of.
    removePlayer(player) {
        this.players_.delete(player);
        this.manager_.onPlayerRemovedFromRegistration(player, this);

        // TODO: Dispose of the registration if there are no players left.
    }

    // ---------------------------------------------------------------------------------------------
    // GameActivity implementation

    getActivityState() { return GameActivity.kStateRegistered; }
    getActivityName() { return this.description_.name; }
}

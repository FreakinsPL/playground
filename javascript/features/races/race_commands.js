// Copyright 2015 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

import { CommandBuilder } from 'components/commands/command_builder.js';
import { Menu } from 'components/menu/menu.js';

import { formatTime } from 'base/time.js';

// Title of the dialog that displays the available races.
const DIALOG_TITLE = 'Racing on Las Venturas Playground';

// The race commands class provides the interface between players' ability to execute commands, and
// the ability to start or control races. It uses the command manager to do so.
class RaceCommands {
    constructor(manager) {
        this.manager_ = manager;

        server.commandManager.buildCommand('race')
            .description(`Compete in one of the server's races.`)
            .sub(CommandBuilder.kTypeNumber, 'id')
                .description(`Compete in one of the server's races.`)
                .build(RaceCommands.prototype.raceStart.bind(this))
            .build(RaceCommands.prototype.raceOverview.bind(this));
    }

    // Either starts or joins the race with |id|, depending on whether an instance of the race is
    // currently accepting sign-ups. If not, a new sign-up round will be started.
    raceStart(player, id) {
        if (player.activity != Player.PLAYER_ACTIVITY_NONE)
            return player.sendMessage(Message.RACE_ERROR_ALREADY_ENGAGED);

        if (!this.manager_.isValid(id))
            return player.sendMessage(Message.RACE_ERROR_INVALID_RACE_ID);

        if (player.interiorId !== 0 || player.virtualWorld !== 0)
            return player.sendMessage(Message.RACE_ERROR_NOT_OUTSIDE);

        // TODO: Withdraw the price of playing a race from the player's account.

        this.manager_.startRace(player, id);
    }

    // Creates a dialog that provides an overview of the available races, together with their all-
    // time best times, and personalized best times if the player has logged in to their account.
    raceOverview(player) {
        if (player.interiorId !== 0 || player.virtualWorld !== 0)
            return player.sendMessage(Message.RACE_ERROR_NOT_OUTSIDE);

        this.manager_.loadRecordTimesForPlayer(player).then(races => {
            // Bail out if there are no races, since there won't be anything to display.
            if (!races.length)
                return player.sendMessage(Message.RACE_ERROR_NO_RACES_AVAILABLE);

            // A player's personal best time will be displayed if they're registered.
            let displayPersonalBest = player.account.isRegistered();

            let columns = ['Race', 'Best time'];
            if (displayPersonalBest)
                columns.push('Your best time');

            let menu = new Menu(DIALOG_TITLE, columns);
            races.forEach(race => {
                let columnValues = [race.name];

                // Append the best time on Las Venturas Playground to the values.
                if (race.bestRace !== null) {
                    columnValues.push(
                        formatTime(race.bestRace.time) + ' (' + race.bestRace.name + ')');
                } else {
                    columnValues.push('---');
                }

                // If the user has logged in, append their personal best to the values.
                if (displayPersonalBest) {
                    if (race.personalBestTime !== null)
                        columnValues.push(formatTime(race.personalBestTime));
                    else
                        columnValues.push('---');
                }

                // Append the item, with a per-row listener to start the selected race.
                menu.addItem(
                    ...columnValues, RaceCommands.prototype.raceStart.bind(this, player, race.id));
            });

            // Display the created menu to the player. Listeners will start a race when selected.
            menu.displayForPlayer(player);
        });
    }

    dispose() {
        server.commandManager.removeCommand('race');
    }
}

export default RaceCommands;

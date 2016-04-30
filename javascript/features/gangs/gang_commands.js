// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

const Dialog = require('components/dialogs/dialog.js');
const Gang = require('features/gangs/gang.js');
const QuestionSequence = require('components/dialogs/question_sequence.js');

// Implements the commands available as part of the persistent gang feature. The primary ones are
// /gang and /gangs, each of which has a number of sub-options available to them.
class GangCommands {
    constructor(manager) {
        this.manager_ = manager;

        // Promises that can be used for testing purposes.
        this.createdPromiseForTesting_ = null;
        this.leavePromiseForTesting_ = null;

        // /pgang [create]
        server.commandManager.buildCommand('pgang')
            .restrict(Player.LEVEL_ADMINISTRATOR)
            .sub('create')
                .build(GangCommands.prototype.onGangCreateCommand.bind(this))
            .sub('leave')
                .build(GangCommands.prototype.onGangLeaveCommand.bind(this))
            .build(GangCommands.prototype.onGangCommand.bind(this));

        // /pgangs [top]
        server.commandManager.buildCommand('pgangs')
            .restrict(Player.LEVEL_ADMINISTRATOR)
            .sub('top')
                .build(GangCommands.prototype.onGangsTopCommand.bind(this))
            .build(GangCommands.prototype.onGangsCommand.bind(this));
    }

    // Called when the player uses the `/gang create` command to create a new gang. If the player is
    // eligible, it will start a wizard of dialog boxes requesting the necessary information from
    // the player. All values must be unique among other gangs in the database.
    onGangCreateCommand(player) {
        let resolveForTests = null;

        if (!player.isRegistered()) {
            player.sendMessage(Message.GANGS_NOT_REGISTERED);
            return;
        }

        if (this.manager_.gangForPlayer(player) !== null) {
            player.sendMessage(Message.GANGS_ALREADY_SET);
            return;
        }

        // Create a "gang has been created" promise that tests can use to observe progress.
        this.createdPromiseForTesting_ = new Promise(resolve => resolveForTests = resolve);

        // Options for asking the player what the gang's full name should be.
        const nameQuestion = {
            question: 'Choose your gang\'s name',
            message: 'What is the full name your gang will be known as?',
            constraints: {
                min: 4, max: 32,
                explanation: 'The name of your gang must be between 4 and 32 characters long.',
                abort: 'Sorry, you cannot create a gang without a valid name!'
            }
        };

        // Options for asking the player what the gang's tag should be.
        const tagQuestion = {
            question: 'Choose your gang\'s tag',
            message: 'What should we use as the gang\'s tag (without brackets)?',
            constraints: {
                min: 1, max: 5,
                explanation: 'The tag of your gang must be between 1 and 5 characters long, and ' +
                             'does not have to contain brackets.',
                abort: 'Sorry, you cannot create a gang without a valid tag!'
            }
        };

        // Options for asking the player what the gang's goal should be.
        const goalQuestion = {
            question: 'Choose your gang\'s goal',
            message: 'In one sentence, what is the purpose of your gang?',
            constraints: {
                min: 4, max: 128,
                explanation: 'The goal of your gang must be between 4 and 128 characters long, ' +
                             'just a brief sentence.',
                abort: 'Sorry, you cannot create a gang without a goal!'
            }
        };

        // Ask the questions to the player, and only proceed if they answered everything.
        QuestionSequence.ask(player, [ nameQuestion, tagQuestion, goalQuestion ]).then(answers => {
            if (!answers)
                return;  // they clicked `cancel` or got a dialog with an explanation

            const [ name, tag, goal ] = answers;

            this.manager_.createGangForPlayer(player, tag, name, goal).then(result => {
                if (!result)
                    return;  // the player disconnected from the server

                // TODO(Russell): Announce the gang's creation to administrators.

                player.sendMessage(Message.GANG_DID_CREATE, result.name);

            }, error => {
                return Dialog.displayMessage(
                    player, 'Unable to create your gang', error.message, 'Close', '');

            }).then(() => resolveForTests())
        });
    }

    // Called when the player uses the `/gang leave` command. It will show a confirmation dialog
    // informing them of the consequences of leaving the gang. This differs for Leaders and regular
    // members of a gang, because gangs cannot be left without a leader.
    onGangLeaveCommand(player) {
        let resolveForTests = null;

        const gang = this.manager_.gangForPlayer(player);
        if (!gang) {
            player.sendMessage(Message.GANG_NOT_IN_GANG);
            return;
        }

        // Create a "player has left" promise that tests can use to observe progress.
        this.leavePromiseForTesting_ = new Promise(resolve => resolveForTests = resolve);

        const commonMsg = Message.format(Message.GANG_LEAVE_CONFIRMATION, gang.name);

        // Regular members and managers of a gang can leave without succession determination.
        if (gang.getPlayerRole(player) != Gang.ROLE_LEADER) {
            Dialog.displayMessage(player, 'Are you sure?', commonMsg, 'Yes', 'No').then(result => {
                if (!result.response)
                    return;  // the player changed their mind

                return this.manager_.removePlayerFromGang(player, gang).then(() => {
                    player.sendMessage(Message.GANG_DID_LEAVE, gang.name);

                    // TODO(Russell): Announce the player's departure to administrators.
                    // TODO(Russell): Announce the player's departure to other gang members.
                });

            }).then(() => resolveForTests());

            return;
        }

        // The |player| is a leader of the gang, confirm the succession, if any, with them.
        this.manager_.determineSuccessionAfterDeparture(player, gang).then(succession => {
            // If there is no known succession, there either are no other members of the gang or the
            // gang has multiple leaders, in which case succession is unnecessary.
            if (!succession) {
                return Promise.all([
                    null /* successionUserId */,
                    Dialog.displayMessage(player, 'Are you sure?', commonMsg, 'Yes', 'No')
                ]);
            }

            // The confirmation message includes the player who is about to be promoted to leader.
            const confirmationMsg = Message.format(Message.GANG_LEAVE_PROMO_CONFIRMATION, gang.name,
                                                   succession.username, succession.role);

            return Promise.all([
                succession.userId,
                Dialog.displayMessage(player, 'Are you sure?', confirmationMsg, 'Yes', 'No')
            ]);

        }).then(([successionUserId, result]) => {
            if (!result.response)
                return;  // the player changed their mind

            // Remove |player| from the |gang| and promote |successionUserId| to leader when set.
            let actions = [ this.manager_.removePlayerFromGang(player, gang) ];
            if (successionUserId) {
                actions.push(
                    this.manager_.updateRoleForUserId(successionUserId, gang, Gang.ROLE_LEADER));
            }

            return Promise.all(actions);

        }).then(() => {
            player.sendMessage(Message.GANG_DID_LEAVE, gang.name);

            // TODO(Russell): Announce the player's departure to administrators.
            // TODO(Russell): Announce the player's departure to other gang members.

        }).then(() => resolveForTests());
    }

    // Called when the player uses the `/gang` command without parameters. It will show information
    // on the available sub commands, as well as the feature itself.
    onGangCommand(player) {
        player.sendMessage(Message.GANGS_HEADER);
        player.sendMessage(Message.GANG_INFO_1);
        player.sendMessage(Message.GANG_INFO_2);
        player.sendMessage(Message.COMMAND_USAGE, '/gang [create/leave]');
    }

    // Called when the player uses the `/gangs` command. It will, by default, list the gangs that
    // are currently represented on Las Venturas Playground, but the "top" sub-command is available
    // to list the top 5 all-round gangs on the server.
    onGangsCommand(player) {
        let gangs = this.manager_.gangs;

        // Sort the |gangs| by number of in-game players in descending order, then by the name of
        // the gang, which is the order they will be presented in.
        gangs.sort((lhs, rhs) => {
            if (lhs.memberCount > rhs.memberCount)
                return 1;

            return lhs.name.localeCompare(rhs.name);
        });

        player.sendMessage(Message.GANGS_HEADER);

        // Display a line for each of the entries in |gangs|, that has now been sorted.
        gangs.forEach(gang => {
            const color = gang.color ? gang.color.toHexRGB() : 'B1FC17';
            const tag = gang.tag;
            const name = gang.name;
            const memberCount = gang.memberCount;
            const memberSuffix = gang.memberCount == 1 ? '' : 's';

            player.sendMessage(Message.GANGS_ONLINE, color, tag, name, memberCount, memberSuffix);
        });

        if (!gangs.length)
            player.sendMessage(Message.GANGS_NONE_ONLINE);

        player.sendMessage(Message.GANGS_BEST_ADV);
    }

    // Called when a player uses the `/gangs top` command. Displays the top 5 gangs on the server
    // regardless of whether they currently have players in-game.
    onGangsTopCommand(player) {
        // TODO(Russell): List the top 5 gangs from the database once we figure out rankings.
    }

    // Cleans up the state created by this class, i.e. unregisters the commands.
    dispose() {
        server.commandManager.removeCommand('pgangs');
    }
}

exports = GangCommands;

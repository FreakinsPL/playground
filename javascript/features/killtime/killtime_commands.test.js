// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

import Economy from 'features/economy/economy.js';
import Killtime from 'features/killtime/killtime.js';

describe('Killtime', (it, beforeEach) => {
    let gunther = null;

    beforeEach(async () => {
        server.featureManager.registerFeaturesForTests({
            economy: Economy,
            killtime: Killtime
        });

        server.featureManager.loadFeature('killtime');

        gunther = server.playerManager.getById(0 /* Gunther */);

        await gunther.identify();
        gunther.level = Player.LEVEL_ADMINISTRATOR;
    });

    it('should show the usage for administrators without any parameters', async (assert) => {
        assert.isTrue(await gunther.issueCommand('/killtime'));

        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0], Message.format(Message.COMMAND_USAGE, Message.KILLTIME_USAGE));
    });

    it('should not be able to be started outside of the time limitations', async (assert) => {
        assert.isTrue(await gunther.issueCommand('/killtime start 1'));
        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0], Message.KILLTIME_MINIMUM_TWO_MINUTES);

        gunther.clearMessages();

        assert.isTrue(await gunther.issueCommand('/killtime start 100'));
        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0], Message.KILLTIME_MAXIMUM_TEN_MINUTES);
    });

    it('should be able to be started for the standard 2 minutes by a registered administrator', async (assert) => {
        const minutesToRun = 2;
        const killtimeMessage = Message.format(Message.KILLTIME_STARTED, minutesToRun);

        assert.isTrue(await gunther.issueCommand('/killtime start'));

        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0], Message.format(Message.ANNOUNCE_ALL, killtimeMessage));
    });

    it('should be able to be started for 3 minutes by a registered administrator', async (assert) => {
        const minutesToRun = 3;
        const killtimeMessage = Message.format(Message.KILLTIME_STARTED, minutesToRun);

        assert.isTrue(await gunther.issueCommand('/killtime start ' + minutesToRun));

        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0], Message.format(Message.ANNOUNCE_ALL, killtimeMessage));
    });

    it('should show that at a manual stop it is stopped by an administrator without a winner', async (assert) => {
        assert.isTrue(await gunther.issueCommand('/killtime start'));
        gunther.clearMessages();
        assert.isTrue(await gunther.issueCommand('/killtime stop'));

        assert.equal(gunther.messages.length, 2);
        assert.equal(gunther.messages[0], Message.format(Message.ANNOUNCE_ALL, Message.KILLTIME_ADMIN_STOPPED));
        assert.equal(gunther.messages[1],
            Message.format(Message.ANNOUNCE_ALL, Message.format(Message.KILLTIME_WINNER, 'nobody', '')));
    });

    it('should show that at a manual stop it is stopped by an administrator with a winner', async(assert) => {
        const russell = server.playerManager.getById(1 /* Russell */);
        const luce    = server.playerManager.getById(2 /* Luce    */);
        const prizeMoney = 25000; // Correct money is handled and unittested in economy
        const prizeMessage = Message.format(Message.KILLTIME_ENJOY_PRIZE, prizeMoney);

        assert.isTrue(await gunther.issueCommand('/killtime start'));

        luce.die(russell);
        russell.die(gunther);
        luce.die();
        gunther.die(luce);
        luce.die(gunther);

        await server.clock.advance(61 * 1000);
        gunther.clearMessages();
        assert.isTrue(await gunther.issueCommand('/killtime stop'));

        const finance = server.featureManager.loadFeature('finance');

        assert.equal(gunther.messages.length, 2);
        assert.equal(gunther.messages[0], Message.format(Message.ANNOUNCE_ALL, Message.KILLTIME_ADMIN_STOPPED));
        assert.equal(gunther.messages[1],
            Message.format(Message.ANNOUNCE_ALL, Message.format(Message.KILLTIME_WINNER, gunther.name + ' with 2 kills', prizeMessage)));
        assert.equal(finance.getPlayerCash(gunther), prizeMoney);
        assert.equal(finance.getPlayerCash(russell), 0);
        assert.equal(finance.getPlayerCash(luce), 0);
    });

    it('should show that the time is over without a winner', async(assert) => {
        assert.isTrue(await gunther.issueCommand('/killtime start'));
        await server.clock.advance(61 * 1000);
        gunther.clearMessages();
        await server.clock.advance(60 * 1000);

        assert.equal(gunther.messages.length, 2);
        assert.equal(gunther.messages[0], Message.format(Message.ANNOUNCE_ALL, Message.KILLTIME_AUTO_STOPPED));
        assert.equal(gunther.messages[1],
            Message.format(Message.ANNOUNCE_ALL, Message.format(Message.KILLTIME_WINNER, 'nobody', '')));
    });

    it('should show that the time is over with a winner', async(assert) => {
        const russell = server.playerManager.getById(1 /* Russell */);
        const luce    = server.playerManager.getById(2 /* Luce    */);
        const prizeMoney = 27000; // Correct money is handled and unittested in economy
        const prizeMessage = Message.format(Message.KILLTIME_ENJOY_PRIZE, prizeMoney);

        assert.isTrue(await gunther.issueCommand('/killtime start'));
        await server.clock.advance(61 * 1000);
        gunther.clearMessages();

        luce.die(russell);
        russell.die(gunther);
        luce.die();
        gunther.die(luce);
        luce.die(gunther);
        luce.die(russell);
        russell.die(gunther);
        luce.die();
        gunther.die(luce);
        luce.die(russell);
        luce.die();
        gunther.die(luce);

        await server.clock.advance(60 * 1000);

        const finance = server.featureManager.loadFeature('finance');

        assert.equal(gunther.messages.length, 2);
        assert.equal(gunther.messages[0], Message.format(Message.ANNOUNCE_ALL, Message.KILLTIME_AUTO_STOPPED));
        assert.equal(gunther.messages[1],
            Message.format(Message.ANNOUNCE_ALL, Message.format(Message.KILLTIME_WINNER, russell.name + ' with 3 kills', prizeMessage)));
        assert.equal(finance.getPlayerCash(gunther), 0);
        assert.equal(finance.getPlayerCash(russell), prizeMoney);
        assert.equal(finance.getPlayerCash(luce), 0);
    });

    it('should register a kill 1 second before the minutely announceTopKiller', async(assert) => {
        const russell = server.playerManager.getById(1 /* Russell */);
        const amountOfKillsByGunther = 1;
        const killtimeMessage = Message.format(
            Message.KILLTIME_TOPKILLER, gunther.name + ' with ' + amountOfKillsByGunther + ' kills', 25000);

        assert.isTrue(await gunther.issueCommand('/killtime start'));
        russell.clearMessages();

        await server.clock.advance(59 * 1000);
        russell.die(gunther);
        await server.clock.advance(1 * 1000);

        assert.equal(russell.messages.length, 1);
        assert.equal(russell.messages[0], Message.format(Message.ANNOUNCE_ALL, killtimeMessage));
    });

    it('should give error upon using an invalid weapon', async assert => {
        assert.isTrue(await gunther.issueCommand('/killtime start 2 0'));
        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0], Message.KILLTIME_INVALID_WEAPON);
    });

    it('should allow using a valid weapon', async assert => {
        const minutesToRun = 2;
        const killtimeMessage = Message.format(Message.KILLTIME_STARTED, minutesToRun);

        assert.isTrue(await gunther.issueCommand('/killtime start 2 35'));
        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0], Message.format(Message.ANNOUNCE_ALL, killtimeMessage));
    });
});

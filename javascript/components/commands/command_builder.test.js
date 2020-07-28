// Copyright 2020 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

import { CommandBuilder } from 'components/commands/command_builder.js';
import { CommandDescription } from 'components/commands/command_description.js';

describe('CommandBuilder', (it, beforeEach) => {
    let description = null;

    beforeEach(() => description = null);

    // Helper function to start creating a command builder that will write the resulting description
    // to the test-local |description| variable.
    function buildCommand(name) {
        return new CommandBuilder({
            listener: result => description = result,
            name: name,
            prefix: '/',
        });
    }

    // A listener function that can be passed to the build() function, but does nothing.
    function emptyListener() {}

    it('should be able to build simple commands', assert => {
        buildCommand('test')
            .description('This is a test command')
            .build(emptyListener);

        assert.isNotNull(description);
        assert.instanceOf(description, CommandDescription);
        assert.equal(description.command, '/test');
        assert.equal(description.commandName, 'test');
        assert.equal(description.description, 'This is a test command');
        assert.typeOf(description.listener, 'function');
        assert.equal(description.parameters.length, 0);
        assert.equal([ ...description.subs ].length, 0);
    });
});
// Copyright 2020 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

// The file in which information about the system has been stored. Must be a service account key
// file generated by the Google Cloud Console.
const kAuthenticationFile = 'gunther.json';

// Private key that can be used for testing purposes. Sourced from Wikipedia's page on PKCS 8.
const kPrivateKeyForTesting = `-----BEGIN PRIVATE KEY-----
MIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8AgEAAkEAq7BFUpkGp3+LQmlQ
Yx2eqzDV+xeG8kx/sQFV18S5JhzGeIJNA72wSeukEPojtqUyX2J0CciPBh7eqclQ
2zpAswIDAQABAkAgisq4+zRdrzkwH1ITV1vpytnkO/NiHcnePQiOW0VUybPyHoGM
/jf75C5xET7ZQpBe5kx5VHsPZj0CBb3b+wSRAiEA2mPWCBytosIU/ODRfq6EiV04
lt6waE7I2uSPqIC20LcCIQDJQYIHQII+3YaPqyhGgqMexuuuGx+lDKD6/Fu/JwPb
5QIhAKthiYcYKlL9h8bjDsQhZDUACPasjzdsDEdq8inDyLOFAiEAmCr/tZwA3qeA
ZoBzI10DGPIuoKXBd3nk/eBxPkaxlEECIQCNymjsoI7GldtujVnr1qT+3yedLfHK
srDVjIT3LsvTqw==
-----END PRIVATE KEY-----`;

// The private token, to force-disable the constructor of the system.
const kPrivateToken = Symbol('Gunther');

// Encapsulates the authentication info that's been made available for the service account in the
// JSON configuration file, when it exists, which is an optional feature of LVP.
export class AuthenticationInfo {
    static loadFromDisk() {
        let authenticationContents = null;
        try {
            authenticationContents = readFile(kAuthenticationFile);
        } catch {
            return null;  // the |kAuthenticationFile| does not exist
        }

        return new AuthenticationInfo(kPrivateToken, JSON.parse(authenticationContents));
    }

    static loadForTesting() {
        return new AuthenticationInfo(kPrivateToken, {
            type: 'service_account',
            auth_uri: 'https://auth.sa-mp.nl/auth',
            client_email: 'info+test@sa-mp.nl',
            client_id: '1234567890',
            private_key: kPrivateKeyForTesting,
            private_key_id: 'private-key-for-testing',
            project_id: 'lvp-testing-project',
            token_uri: 'https://auth.sa-mp.nl/token',
        });
    }

    #authenticationUrl_ = null;
    #clientEmail_ = null;
    #clientId_ = null;
    #privateKey_ = null;
    #privateKeyId_ = null;
    #projectId_ = null;
    #tokenUrl_ = null;

    // Gets the URL against which authentication can commence.
    get authenticationUrl() { return this.#authenticationUrl_; }

    // Gets the e-mail address associated with this service account.
    get clientEmail() { return this.#clientEmail_; }

    // Gets the unique ID, as a number, of the service account client.
    get clientId() { return this.#clientId_; }

    // Gets the private key as an ASN.1 encoded string.
    get privateKey() { return this.#privateKey_; }

    // Gets the ID of the private key, used by the server to authenticate.
    get privateKeyId() { return this.#privateKeyId_; }

    // Gets the Project ID that this client is part of.
    get projectId() { return this.#projectId_; }

    // Gets the URL against which JWT tokens can be issued, to get authentication tokens back.
    get tokenUrl() { return this.#tokenUrl_; }

    constructor(privateToken, configuration){ 
        if (privateToken !== kPrivateToken)
            throw new Error(`Only use AuthenticationInfo.loadFromDisk() to instantiate this class`);

        if (configuration.type !== 'service_account')
            throw new Error(`Only service accounts can be loaded as authentication information`);

        this.#authenticationUrl_ = configuration.auth_uri;
        this.#clientEmail_ = configuration.client_email;
        this.#clientId_ = parseInt(configuration.client_id, 10);
        this.#privateKey_ = configuration.private_key;
        this.#privateKeyId_ = configuration.private_key_id;
        this.#projectId_ = configuration.project_id;
        this.#tokenUrl_ = configuration.token_uri;
    }
}

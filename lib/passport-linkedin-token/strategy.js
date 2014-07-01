/**
 * Module dependencies.
 */
var util = require('util')
  , OAuthStrategy = require('passport-oauth').OAuthStrategy
  , InternalOAuthError = require('passport-oauth').InternalOAuthError;


/**
 * `LinkedInTokenStrategy` constructor.
 *
 * The LinkedIn authentication strategy authenticates requests by delegating to
 * LinkedIn using the OAuth protocol.
 *
 * Applications must supply a `verify` callback which accepts a `token`,
 * `tokenSecret` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `consumerKey`     identifies client to LinkedIn
 *   - `consumerSecret`  secret used to establish ownership of the consumer key
 *
 * Examples:
 *
 *     passport.use(new LinkedInTokenStrategy({
 *         consumerKey: '123-456-789',
 *         consumerSecret: 'shhh-its-a-secret'
 *       },
 *       function(token, tokenSecret, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function LinkedInTokenStrategy(options, verify) {
  options = options || {};
  options.requestTokenURL = options.requestTokenURL || 'https://api.linkedin.com/uas/oauth/requestToken';
  options.accessTokenURL = options.accessTokenURL || 'https://api.linkedin.com/uas/oauth/accessToken';
  options.userAuthorizationURL = options.userAuthorizationURL || 'https://www.linkedin.com/uas/oauth/authenticate';
  options.sessionKey = options.sessionKey || 'oauth:linkedin';

  OAuthStrategy.call(this, options, verify);
  this.name = 'linkedin-token';

  this._skipExtendedUserProfile = (options.skipExtendedUserProfile === undefined) ? false : options.skipExtendedUserProfile;
}

/**
 * Inherit from `OAuthLinkedInTokenStrategy`.
 */
util.inherits(LinkedInTokenStrategy, OAuthStrategy);


/**
 * Authenticate request by delegating to LinkedIn using OAuth.
 *
 * @param {Object} req
 * @api protected
 */
LinkedInTokenStrategy.prototype.authenticate = function(req, options) {
  // When a user denies authorization on LinkedIn, they are presented with a link
  // to return to the application in the following format (where xxx is the
  // value of the request token):
  //
  //     http://www.example.com/auth/linkedin/callback?denied=xxx
  //
  // Following the link back to the application is interpreted as an
  // authentication failure.
  if (req.query && req.query.denied) {
    return this.fail();
  }
  
  var self = this;
  var token = req.body.oauth_token || req.query.oauth_token;
  var tokenSecret = req.body.oauth_token_secret || req.query.oauth_token_secret;
  
  var params = { };
  
  self._loadUserProfile(token, tokenSecret, params, function(err, profile) {
    if (err) { return self.error(err); };
    
    function verified(err, user, info) {
      if (err) { return self.error(err); }
      if (!user) { return self.fail(info); }
      self.success(user, info);
    }
    
    if (self._passReqToCallback) {
      var arity = self._verify.length;
      if (arity == 6) {
        self._verify(req, token, tokenSecret, params, profile, verified);
      } else { // arity == 5
        self._verify(req, token, tokenSecret, profile, verified);
      }
    } else {
      var arity = self._verify.length;
      if (arity == 5) {
        self._verify(token, tokenSecret, params, profile, verified);
      } else { // arity == 4
        self._verify(token, tokenSecret, profile, verified);
      }
    }
  });
}

/**
 * Retrieve user profile from LinkedIn.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `id`        (equivalent to `user_id`)
 *   - `username`  (equivalent to `screen_name`)
 *
 * Note that because LinkedIn supplies basic profile information in query
 * parameters when redirecting back to the application, loading of LinkedIn
 * profiles *does not* result in an additional HTTP request, when the
 * `skipExtendedUserProfile` is enabled.
 *
 * @param {String} token
 * @param {String} tokenSecret
 * @param {Object} params
 * @param {Function} done
 * @api protected
 */
LinkedInTokenStrategy.prototype.userProfile = function(token, tokenSecret, params, done) {
  var url = 'https://api.linkedin.com/v1/people/~:(id,first-name,last-name,public-profile-url)?format=json';
  if (this._profileFields) {
    var fields = this._convertProfileFields(this._profileFields);
    url = 'https://api.linkedin.com/v1/people/~:(' + fields + ')?format=json';
  }

  this._oauth.get(url, token, tokenSecret, function (err, body, res) {
    if (err) { return done(new InternalOAuthError('failed to fetch user profile', err)); }
    
    try {
      var json = JSON.parse(body);
      
      var profile = { provider: 'linkedin' };
      profile.id = json.id;
      profile.displayName = json.firstName + ' ' + json.lastName;
      profile.name = { familyName: json.lastName,
                       givenName: json.firstName };
      if (json.emailAddress) { profile.emails = [{ value: json.emailAddress }]; }
      
      profile._raw = body;
      profile._json = json;
      
      done(null, profile);
    } catch(e) {
      done(e);
    }
  });
}

/**
 * Return extra LinkedIn-specific parameters to be included in the user
 * authorization request.
 *
 * @param {Object} options
 * @return {Object}
 * @api protected
 */
LinkedInTokenStrategy.prototype.userAuthorizationParams = function(options) {
  var params = {};
  if (options.forceLogin) {
    params['force_login'] = options.forceLogin;
  }
  if (options.screenName) {
    params['screen_name'] = options.screenName;
  }
  return params;
}


/**
 * Expose `LinkedInTokenStrategy`.
 */
module.exports = LinkedInTokenStrategy;

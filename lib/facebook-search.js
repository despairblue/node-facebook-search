var https = require('https'),
    url = require('url'),
    auth = require('oauth'),
    qs = require('querystring'),
    _ = require('underscore');

function FacebookSearch(apiKey, apiSecret, opts) {
    this.auth = {
        key: apiKey,
        secret: apiSecret,
        token: undefined,
        code: undefined
    };
    
    this.config = _.defaults((opts || {}), {
        'redirect_uri': 'http://127.0.0.1:3000/',
        'protocol': 'https',
        'host': 'graph.facebook.com',
        'path': 'search',
        'scope': 'client_credentials'
    });
    
    this.paging = {};
};

FacebookSearch.prototype.getAuthorizationUrl = function(opts) {
    opts = _.defaults((opts || {}), {
        protocol: 'https',
        host: 'www.facebook.com',
        path: '/dialog/oauth',
        scope: this.config.scope
    });

    query = {
        'client_id': this.auth.key,
        'redirect_uri': this.config.redirect_uri,
        'scope': _.isArray(opts.scope) ? opts.scope.join(',') : opts.scope
    };
    
    return url.format({
        protocol: opts.protocol,
        host: opts.host,
        pathname: opts.path,
        query: query
    });
};

FacebookSearch.prototype.handleAuthorizationResponse = function(res, cb) {
    var data = qs.parse(res);
    
    if(data.error) {
        cb({error: {type: data.error_reason, message: data.error_description}});
    } else {
        this.auth.code = data.code;
        
        this.requestAccessToken(cb);   
    }
};

FacebookSearch.prototype.setAuthorizationCode = function(code) {
    // Setting Code invalidates Access Token
    this.auth.token = undefined;
    this.auth.code = code;
};

FacebookSearch.prototype.setAccessToken = function(token) {
    this.auth.token = token;
};

FacebookSearch.prototype.requestAccessToken = function(opts, cb) {
    if(opts === undefined || typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    
    var self = this;
    opts = _.defaults(opts, {
        path: '/oauth/access_token'
    });
    
    var _handleTokenResponse = function(err, tok) {
        if(tok) {
            self.auth.token = qs.parse(tok).access_token;
        }
            
        cb(err, self.auth.token !== undefined);
    };
    
    if(self.auth.code) {
        var oauth = new auth.OAuth2(self.auth.key, self.auth.secret, url.format({protocol: self.config.protocol, host: self.config.host}), null, opts.path);
        oauth.getOAuthAccessToken(self.auth.code, {'client_id': self.auth.key, 'client_secret': self.auth.secret, 'redirect_uri': opts.redirect_uri}, _handleTokenResponse);
    } else {
        // Auth as App without User
        _doRequest(url.format({
            protocol: self.config.protocol,   
            host: self.config.host,
            pathname: opts.path,
            query: {
                'client_id': self.auth.key,
                'client_secret': self.auth.secret,
                'grant_type': self.config.scope
            }
        }), _handleTokenResponse);  
    }
};

FacebookSearch.prototype.search = function(req, cb) {
    if(req === undefined || typeof req === 'function') {
        cb = req;
        req = {};
    }
    
    var self = this;
    
    if(this.auth.token) {           
        if(typeof req !== 'string') {
            req = _.defaults(req, {
                'type': 'post',
                'access_token': this.auth.token
            });
            
            req = url.format({
                protocol: self.config.protocol,   
                host: self.config.host,
                pathname: self.config.path,
                query: req
            });
        }
      
        _doRequest(req, function(e, d) {
            var json = JSON.parse(d);
            
            if(json.error) {
                cb(json.error);
            } else {
                self.paging = json.paging;
                
                cb(null, json.data);
            }
        });
    } else {
        self.requestAccessToken(function(err, res) {
           if(res) self.search(req, cb); 
        });
    }
};

FacebookSearch.prototype.previous = function(cb) {
    if(this.paging.previous) {
        this.search(this.paging.previous, cb);
    }
};

FacebookSearch.prototype.next = function(cb) {
    if(this.paging.next) {
        this.search(this.paging.next, cb);
    }
};

function _doRequest(req, cb) {
    if(typeof req === 'string') req = url.parse(req);
    
    https.get(req, function(res) {
        var buffer = '';
        
        res.on('data', function(d) {
            buffer += d;
        }).on('end', function() {
            cb(null, buffer);
        });
    }).on('error', function(e) {
        cb(e);
    });
};

module.exports = FacebookSearch;

var https = require('https'),
    url = require('url'),
    _ = require('underscore');

function FacebookSearch(apiKey, apiSecret, opts) {
    this.auth = {
        key: apiKey,
        secret: apiSecret,
        token: undefined
    };
    
    this.config = _.defaults((opts || {}), {
        protocol: 'https',
        host: 'graph.facebook.com',
        path:  'search'
    });
    
    this.paging = {};
};

FacebookSearch.prototype.authorize = function(opts, cb) {
    if(opts === undefined || typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    
    var self = this;
    opts = _.defaults(opts, {
        path: 'oauth/access_token',
        type: 'client_credentials'
    });
    
    _doRequest(url.format({
        protocol: self.config.protocol,   
        host: self.config.host,
        pathname: opts.path,
        query: {
            'client_id': self.auth.key,
            'client_secret': self.auth.secret,
            'grant_type': opts.type
        }
    }), function(e, d) {        
        if(d !== undefined) {
            var res = d.split('=');
            
            if(res.length == 2 && res[0] == 'access_token') {
                self.auth.token = res[1];
            } 
        }
        
        cb(self.auth.token !== undefined);
    });  
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
        self.authorize(function(res) {
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
        var buffer = [];
        
        res.on('data', function(d) {
            buffer.push(d);
        }).on('end', function() {
            cb(null, buffer.join(''));
        });
    }).on('error', function(e) {
        cb(e);
    });
};

module.exports = FacebookSearch;

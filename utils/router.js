const Trie = require('./trie');

class Router {
    constructor (){ 
        this.routes = new Map();
        this.tries = new Map();
    }
    add(method, path, handler){
        if (!this.routes.has(method)) {
            this.routes.set(method, new Trie());
        }
        this.routes.get(method).insert(path, handler);
    }

    match(method, path){
        const trie = this.routes.get(method);
        if (!trie) return null;

        const { handler, params } = trie.find(path);
        if (!handler) return null;

        
        return (req) => {
            if (params) {
                req.params = params;
            }
            return handler(req);
        };
    }
}
 module.exports = Router;

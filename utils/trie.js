class TrieNode {
  constructor() {
    this.children = new Map();
    this.handler = null;
    this.paramName = null;
    this.isParam = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  // Insert a route pattern into the trie
  insert(pattern, handler) {
    const segments = pattern.split('/').filter(Boolean);
    let current = this.root;

    for (const segment of segments) {
      if (segment.startsWith(':')) {
      
        const paramName = segment.slice(1);
        if (!current.children.has(':')) {
          const paramNode = new TrieNode();
          paramNode.isParam = true;
          paramNode.paramName = paramName;
          current.children.set(':', paramNode);
        }
        current = current.children.get(':');
      } else {
 
        if (!current.children.has(segment)) {
          current.children.set(segment, new TrieNode());
        }
        current = current.children.get(segment);
      }
    }

    current.handler = handler;
  }

 
  find(path) {
    const segments = path.split('/').filter(Boolean);
    const params = {};
    let current = this.root;

    for (const segment of segments) {
      
      if (current.children.has(segment)) {
        current = current.children.get(segment);
        continue;
      }

     
      if (current.children.has(':')) {
        const paramNode = current.children.get(':');
        params[paramNode.paramName] = segment;
        current = paramNode;
        continue;
      }

     
      return { handler: null, params: null };
    }

    return {
      handler: current.handler,
      params: Object.keys(params).length > 0 ? params : null
    };
  }
}

module.exports = Trie; 
const moduleAlias = require('module-alias');
const path = require('path');

// Register aliases
moduleAlias.addAliases({
  '@': path.resolve(__dirname, 'dist')
});

// Register the module aliases
moduleAlias(); 
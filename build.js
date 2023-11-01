import { writeFile } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Eta } from 'eta';

const dirURL = import.meta.url;
const templateDir = fileURLToPath(new URL('./templates/', dirURL));
const destDir = fileURLToPath(new URL('./static/', dirURL));
const indexPath = join(destDir, 'index.html');
const bizIndexPath = join(destDir, 'biz', 'index.html');

const eta = new Eta({ cache: true, views: templateDir });

writeFile(indexPath,    eta.render('./default', { isBiz: false }), callback);
writeFile(bizIndexPath, eta.render('./default', { isBiz: true  }), callback);

function callback(err) {
  if (err) console.error(err);
}

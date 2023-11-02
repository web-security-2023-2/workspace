import { writeFile } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Eta } from 'eta';

const root = import.meta.url;
const templateDir = fileURLToPath(new URL('./templates/', root));
const staticDir = fileURLToPath(new URL('./static/', root));
const statusDir = fileURLToPath(new URL('./status/', root));

const indexPath = join(staticDir, 'index.html');
const bizIndexPath = join(staticDir, 'biz/index.html');

const eta = new Eta({ cache: true, views: templateDir });

writeFile(indexPath,    eta.render('./search', { isAuthorized: false }), err);
writeFile(bizIndexPath, eta.render('./search', { isAuthorized: true  }), err);

writeFile(join(statusDir, '400.html'), eta.render('./status', {
  title: '400 Bad Request',
  message: '올바르지 않은 형식의 요청입니다.',
 }), err);
writeFile(join(statusDir, '404.html'), eta.render('./status', {
  title: '404 Not Found',
  message: '요청하신 URL에는 응답할 리소스가 존재하지 않습니다.',
 }), err);
writeFile(join(statusDir, '405.html'), eta.render('./status', {
  title: '405 Method Not Allowed',
  message: '허용되지 않은 메소드입니다.',
 }), err);
writeFile(join(statusDir, '500.html'), eta.render('./status', {
  title: '500 Internal Server Error',
  message: '서버 장애로 요청을 처리하지 못했습니다.',
 }), err);

function err(e) {
  if (e) console.error(e);
}

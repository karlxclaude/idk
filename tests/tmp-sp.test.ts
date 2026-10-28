import { it } from 'vitest';
import { act, createGame, findPlacement, frontItem, score, step, breakdown } from '../minigames/spatial_packing/logic';
it('x', () => { for (const d of [1,0.3]) for (let i=1;i<=3;i++){ const s=createGame('seed'+i,d); let g=0;
 while(!s.finished&&g++<5000){const it=frontItem(s)!; const P=(a:any,n=1)=>{for(let k=0;k<n&&!s.finished;k++){act(s,a);step(s,0.5);}};
 if(it.distractor){P('reject');continue;} const pl=findPlacement(s.grid,it.cells); if(!pl){P('seal');continue;} P('rotate',pl.rot);const dx=pl.x-s.piece!.x,dy=pl.y-s.piece!.y;P(dx<0?'left':'right',Math.abs(dx));P(dy<0?'up':'down',Math.abs(dy));P('place');}
 console.log(d,i,s.packed,s.targetItems,JSON.stringify(breakdown(s)),score(s));}});

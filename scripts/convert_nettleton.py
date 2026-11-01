import xml.etree.ElementTree as E,json, pathlib,argparse
parser=argparse.ArgumentParser(description="Rebuild hymn.js from the bundled NETTLETON score. This is a score-specific converter, not a general MusicXML importer.")
parser.add_argument("source",nargs="?",default=str(pathlib.Path(__file__).resolve().parents[1]/"scores/come-thou-fount.musicxml"))
parser.add_argument("--output",default=str(pathlib.Path(__file__).resolve().parents[1]/"hymn.js"))
args=parser.parse_args()
r=E.parse(args.source).getroot();parts={};measureStarts={};lyrics={}
for part in r.findall('part'):
 events=[];base=0;div=256
 for measure in part.findall('measure'):
  mi=int(measure.get('number'));measureStarts[mi]=base;pos=0;last=0;end=0
  for child in measure:
   if child.tag=='attributes':div=int(child.findtext('divisions',str(div)))
   elif child.tag=='backup':pos-=int(child.findtext('duration'))/div
   elif child.tag=='forward':pos+=int(child.findtext('duration'))/div
   elif child.tag=='note':
    d=int(child.findtext('duration','0'))/div
    if child.find('chord') is not None:t=last
    else:t=pos;last=t;pos+=d
    end=max(end,t+d)
    pitch=child.find('pitch')
    if pitch is not None:
     step=pitch.findtext('step');alter=int(pitch.findtext('alter','0'));octave=int(pitch.findtext('octave'));midi=12*(octave+1)+dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)[step]+alter
     ev=dict(t=base+t,d=d,m=midi,step=step,alter=alter,octave=octave,measure=mi)
     events.append(ev)
    if part.get('id')=='P1':
     for ly in child.findall('lyric'):
      text=ly.findtext('text','');sy=ly.findtext('syllabic','single');v=ly.get('number')
      lyrics.setdefault(v,[]).append(dict(t=base+t,text=text,hyphen=sy in ('begin','middle')))
  base+=end
 parts[part.get('id')]=events
assert base==48,base
# Read the lower and upper sounding lines of each two-part staff. Keep an event's
# identity across changes in the other voice so held bass notes remain held.
def line(events,lower):
 times=sorted(set([e['t'] for e in events]+[e['t']+e['d'] for e in events]));out=[];identity=None
 for a,b in zip(times,times[1:]):
  active=[e for e in events if e['t']<=a<e['t']+e['d']]
  if not active:continue
  chosen=(min if lower else max)(active,key=lambda e:e['m']);ident=(chosen['t'],chosen['m'])
  if ident==identity and abs(out[-1]['t']+out[-1]['d']-a)<1e-6:out[-1]['d']+=b-a
  else:out.append(dict(chosen,t=a,d=b-a));identity=ident
 return out
tracks=[line(parts['P1'],False),line(parts['P1'],True),line(parts['P2'],False),line(parts['P2'],True)]
starts=[0,12,24,36];sections=[]
for i,a in enumerate(starts):
 b=a+12
 def cut(track):return [dict(e,t=max(a,e['t'])-a,d=min(b,e['t']+e['d'])-max(a,e['t'])) for e in track if e['t']<b and e['t']+e['d']>a]
 sections.append(dict(title=['Come, Thou Fount / Here I raise','Streams of mercy / And I hope','Teach me some / Jesus sought me','Praise the mount / He, to rescue'][i],tracks=[cut(t) for t in tracks],lyrics=[[dict(l,t=l['t']-a) for l in ls if a<=l['t']<b] for ls in list(lyrics.values())[:2]]))
result=dict(title='Come, Thou Fount of Every Blessing',tune='NETTLETON',key='E♭ major',meter='3/4',source='https://library.timelesstruths.org/music/Come_Thou_Fount_of_Every_Blessing/',sections=sections)
pathlib.Path(args.output).write_text('const HYMN='+json.dumps(result,separators=(',',':'))+';\n')
print('Source duration',base,'beats; SATB note counts',[len(t) for t in tracks]);print('Bass range',min(e['m'] for e in tracks[3]),max(e['m'] for e in tracks[3]));print('Sections',[(s['title'],len(s['tracks'][3])) for s in sections])

import json, os, pathlib, subprocess, sys, time
OUT=pathlib.Path('capture-output');OUT.mkdir(exist_ok=True)
def run(*args,check=True,env=None,timeout=120):
 print('RUN',*args,flush=True)
 p=subprocess.run(args,check=check,capture_output=True,text=True,env=env,stdin=subprocess.DEVNULL,timeout=timeout)
 if p.stderr:print(p.stderr,flush=True)
 return p.stdout.strip()
runtimes=json.loads(run('xcrun','simctl','list','runtimes','-j'))['runtimes']
ios=[r for r in runtimes if r.get('isAvailable') and r.get('identifier','').startswith('com.apple.CoreSimulator.SimRuntime.iOS-')]
if not ios:raise RuntimeError('No installed iOS Simulator runtime')
runtime=sorted(ios,key=lambda r:tuple(int(v) for v in r['version'].split('.')))[-1]
types=json.loads(run('xcrun','simctl','list','devicetypes','-j'))['devicetypes']
phone=next(t for t in types if t['name']=='iPhone 14 Plus');ipads=[t for t in types if t['name'].startswith('iPad Pro 13-inch')]
app=next(pathlib.Path(sys.argv[1]).glob('*.app'));bundle='com.pawssible.chorely'
provenance={'source_commit':'4858c4c82c06b952340b1ce36f9b77541b1385f3','capture_commit':os.environ.get('GITHUB_SHA'),'xcode':run('xcodebuild','-version'),'runtime':runtime,'method':'Native iOS Simulator screenshot, after warm-up launch. Unchanged production UI, synthetic data, no production requests.','devices':[]}
for label,device in [('iPhone_6.5',phone)]+([('iPad_13',ipads[-1])] if ipads else []):
 udid=run('xcrun','simctl','create','Chorely Store '+label,device['identifier'],runtime['identifier']);folder=OUT/label;folder.mkdir(exist_ok=True)
 try:
  run('xcrun','simctl','boot',udid);run('xcrun','simctl','bootstatus',udid,'-b',timeout=240)
  run('xcrun','simctl','ui',udid,'appearance','light')
  run('xcrun','simctl','status_bar',udid,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100')
  run('xcrun','simctl','install',udid,str(app))
  container=pathlib.Path(run('xcrun','simctl','get_app_container',udid,bundle,'data'));marker=container/'Documents/capture-ready.json'
  records=[]
  for scene in ['chores','today']:
   run('xcrun','simctl','terminate',udid,bundle,check=False);marker.unlink(missing_ok=True)
   env=dict(os.environ);env['SIMCTL_CHILD_CHORELY_CAPTURE_SCENE']=scene
   run('xcrun','simctl','launch',udid,bundle,env=env)
   for _ in range(90):
    if marker.exists():break
    time.sleep(1)
   if not marker.exists():raise RuntimeError('Capture did not become ready: '+scene)
   record=json.loads(marker.read_text());(folder/(scene+'-capture.json')).write_text(json.dumps(record,indent=2))
   if record.get('error'):raise RuntimeError(record['error'])
   # DOM readiness precedes native first-frame presentation on cold Simulator launches.
   time.sleep(15)
   shot=folder/('00_warmup.png' if scene=='chores' else '01_today.png')
   run('xcrun','simctl','io',udid,'screenshot','--type=png',str(shot),timeout=45)
   records.append(record);print('Captured',label,scene,record['width'],record['height'],flush=True)
  provenance['devices'].append({'device':device,'folder':label,'captures':records})
 except Exception as e:
  (folder/'error.txt').write_text(str(e));raise
 finally:
  (OUT/'capture-provenance.json').write_text(json.dumps(provenance,indent=2));run('xcrun','simctl','shutdown',udid,check=False,timeout=30)

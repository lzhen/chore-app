import json, os, pathlib, subprocess, sys, time
OUT=pathlib.Path('capture-output');OUT.mkdir(exist_ok=True)
def run(*args,check=True,env=None,timeout=90):
 print('RUN',*args,flush=True)
 try:p=subprocess.run(args,check=check,capture_output=True,text=True,env=env,stdin=subprocess.DEVNULL,timeout=timeout)
 except subprocess.TimeoutExpired as e:
  print('TIMEOUT',e.stdout,e.stderr,flush=True)
  if check:raise
  return ''
 if p.stderr:print(p.stderr,flush=True)
 return p.stdout.strip()
runtimes=json.loads(run('xcrun','simctl','list','runtimes','-j'))['runtimes']
ios=[r for r in runtimes if r.get('isAvailable') and r.get('identifier','').startswith('com.apple.CoreSimulator.SimRuntime.iOS-')]
if not ios:raise RuntimeError('No installed iOS Simulator runtime')
runtime=sorted(ios,key=lambda r:tuple(int(v) for v in r['version'].split('.')))[-1]
types=json.loads(run('xcrun','simctl','list','devicetypes','-j'))['devicetypes']
phone=next(t for t in types if t['name']=='iPhone 14 Plus')
ipads=[t for t in types if t['name'].startswith('iPad Pro 13-inch')]
app=next(pathlib.Path(sys.argv[1]).glob('*.app'));bundle='com.pawssible.chorely'
provenance={'source_commit':'4858c4c82c06b952340b1ce36f9b77541b1385f3','capture_commit':os.environ.get('GITHUB_SHA'),'xcode':run('xcodebuild','-version'),'runtime':runtime,'method':'Native iOS Simulator screenshots. Unchanged production UI with synthetic data, no production requests.','devices':[]}
for label,device in [('iPhone_6.5',phone)]+([('iPad_13',ipads[-1])] if ipads else []):
 udid=run('xcrun','simctl','create','Chorely Store '+label,device['identifier'],runtime['identifier'])
 folder=OUT/label;folder.mkdir(exist_ok=True)
 try:
  run('xcrun','simctl','boot',udid,timeout=120)
  run('open','-a','Simulator','--args','-CurrentDeviceUDID',udid,timeout=30,check=False)
  run('xcrun','simctl','bootstatus',udid,'-b',timeout=180)
  run('xcrun','simctl','ui',udid,'appearance','light')
  run('xcrun','simctl','status_bar',udid,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100')
  run('xcrun','simctl','install',udid,str(app))
  container=pathlib.Path(run('xcrun','simctl','get_app_container',udid,bundle,'data'));marker=container/'Documents/capture-ready.json'
  records=[]
  for number,scene in enumerate(['today','chores','calendar','add','insights'],1):
   run('xcrun','simctl','terminate',udid,bundle,check=False,timeout=20);marker.unlink(missing_ok=True)
   env=dict(os.environ);env['SIMCTL_CHILD_CHORELY_CAPTURE_SCENE']=scene
   run('xcrun','simctl','launch',udid,bundle,env=env,timeout=45)
   for _ in range(80):
    if marker.exists():break
    time.sleep(1)
   shot=folder/(str(number).zfill(2)+'_'+scene+'.png');run('xcrun','simctl','io',udid,'screenshot','--type=png',str(shot),timeout=30)
   if not marker.exists():raise RuntimeError('Capture did not become ready: '+scene)
   record=json.loads(marker.read_text());(folder/(scene+'-capture.json')).write_text(json.dumps(record,indent=2))
   if record.get('error'):raise RuntimeError(record['error'])
   records.append(record);print('Captured',label,scene,record['width'],record['height'],flush=True)
  provenance['devices'].append({'device':device,'folder':label,'captures':records})
 except Exception as e:
  (folder/'error.txt').write_text(str(e));raise
 finally:
  (OUT/'capture-provenance.json').write_text(json.dumps(provenance,indent=2))
  run('xcrun','simctl','shutdown',udid,check=False,timeout=20)

import json, os, pathlib, subprocess, sys, time
OUT=pathlib.Path('review-output');OUT.mkdir(exist_ok=True)
def run(*args,check=True,env=None,timeout=180):
 print('RUN',*args,flush=True)
 p=subprocess.run(args,check=check,capture_output=True,text=True,env=env,stdin=subprocess.DEVNULL,timeout=timeout)
 if p.stderr:print(p.stderr,flush=True)
 return p.stdout.strip()
runtimes=json.loads(run('xcrun','simctl','list','runtimes','-j'))['runtimes']
ios=[r for r in runtimes if r.get('isAvailable') and r.get('identifier','').startswith('com.apple.CoreSimulator.SimRuntime.iOS-')]
runtime=sorted(ios,key=lambda r:tuple(int(v) for v in r['version'].split('.')))[-1]
types=json.loads(run('xcrun','simctl','list','devicetypes','-j'))['devicetypes']
device=next(t for t in types if t['name']=='iPhone 14 Plus')
app=next(pathlib.Path(sys.argv[1]).glob('*.app'));bundle='com.pawssible.chorely'
udid=run('xcrun','simctl','create','Chorely App Review',device['identifier'],runtime['identifier'])
try:
 run('xcrun','simctl','boot',udid);run('xcrun','simctl','bootstatus',udid,'-b',timeout=240)
 run('xcrun','simctl','ui',udid,'appearance','light')
 run('xcrun','simctl','status_bar',udid,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100')
 run('xcrun','simctl','install',udid,str(app))
 container=pathlib.Path(run('xcrun','simctl','get_app_container',udid,bundle,'data'));marker=container/'Documents/capture-ready.json'
 env=dict(os.environ);env['SIMCTL_CHILD_CHORELY_CAPTURE_SCENE']='today'
 marker.unlink(missing_ok=True);run('xcrun','simctl','launch',udid,bundle,env=env)
 for _ in range(90):
  if marker.exists():break
  time.sleep(1)
 if not marker.exists():raise RuntimeError('Review scene did not become ready')
 time.sleep(8)
 raw=OUT/'chorely-app-review.mov'
 proc=subprocess.Popen(['xcrun','simctl','io',udid,'recordVideo','--codec=h264',str(raw)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
 time.sleep(3)
 # Relaunch deterministic review scenes so the recording shows real native rendering.
 for scene in ['chores','today','calendar','add','insights','today']:
  run('xcrun','simctl','terminate',udid,bundle,check=False);marker.unlink(missing_ok=True)
  env=dict(os.environ);env['SIMCTL_CHILD_CHORELY_CAPTURE_SCENE']=scene
  run('xcrun','simctl','launch',udid,bundle,env=env)
  for _ in range(60):
   if marker.exists():break
   time.sleep(.5)
  if not marker.exists():raise RuntimeError('Scene timeout: '+scene)
  time.sleep(3)
 proc.send_signal(subprocess.signal.SIGINT if hasattr(subprocess,'signal') else 2)
 try: proc.wait(timeout=20)
 except subprocess.TimeoutExpired: proc.terminate();proc.wait(timeout=10)
 run('ffmpeg','-y','-i',str(raw),'-vf','scale=886:-2','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'chorely-app-review.mp4'),timeout=180)
 (OUT/'review-notes.txt').write_text('Native iPhone Simulator recording with synthetic review-only sample data. No production writes. Shows Today, Chores, Calendar, Add Chore, Insights, and Today again.\n')
finally:
 run('xcrun','simctl','shutdown',udid,check=False,timeout=30)

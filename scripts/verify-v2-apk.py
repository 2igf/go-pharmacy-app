"""Read-only final ordinary/test APK containment and approved bundled asset checks."""
from pathlib import Path
import zipfile,json,hashlib,io
from PIL import Image
root=Path(__file__).resolve().parents[1]
apk=root/'android/app/build/outputs/apk/debug/app-debug.apk'
test=root/'android/app/build/outputs/apk/checkoutTest/app-checkoutTest.apk'
with zipfile.ZipFile(apk) as z,zipfile.ZipFile(test) as tz:
 names=z.namelist();tn=tz.namelist();config=json.loads(z.read('assets/capacitor.config.json'))
 assert config['appId']=='com.gopharmacy.beta' and config['loggingBehavior']=='none'
 assert 'url' not in config['server'] and not config['server']['cleartext'] and not config['android']['allowMixedContent']
 assert not any('checkout_test_ca' in n or 'checkout_test_network_security_config' in n for n in names)
 assert any('checkout_test_ca' in n for n in tn)
 checks=[]
 for p in sorted((root/'.local/v2/android-public').rglob('*')):
  if p.is_file() and not any(part.startswith(".") for part in p.relative_to(root/".local/v2/android-public").parts):
   relative=p.relative_to(root/'.local/v2/android-public').as_posix();key='assets/public/'+relative
   same=z.read(key)==p.read_bytes();checks.append({'asset':relative,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'matchesApk':same});assert same,key
 icons=[]
 for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
  source=root/f'android/app/src/main/res/mipmap-{density}/ic_launcher.png'
  entry=next(n for n in names if n.startswith(f'res/mipmap-{density}') and n.endswith('/ic_launcher.png'))
  a=Image.open(source).convert('RGBA');b=Image.open(io.BytesIO(z.read(entry))).convert('RGBA');same=a.size==b.size==(size,size) and a.tobytes()==b.tobytes();assert same,entry;icons.append({'density':density,'size':size,'sourcePixelsMatchApk':same})
 for private in [root/'.local/v2/db.json',root/'.local/v2/fixture.json']:
  if private.exists():
   data=json.loads(private.read_text(encoding='utf-8-sig'));values=[data['url']] if 'url' in data else [u['password'] for u in data['users'].values()]
   for value in values:
    needle=value.encode()
    assert not any(needle in z.read(n) for n in names if n.startswith('assets/') and not n.endswith('/')),'Private value leaked'
 report={'apk':str(apk.resolve()),'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'bytes':apk.stat().st_size,'package':'com.gopharmacy.beta','normalContainsTestCa':False,'testContainsTestCa':True,'bundledAssets':len(checks),'allBundledAssetsMatch':all(c['matchesApk'] for c in checks),'privateConfigurationAbsent':True,'launcherDensities':icons,'assets':checks}
(root/'docs/evidence/v2/apk-integrity.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print({k:v for k,v in report.items() if k not in ['assets','launcherDensities']})

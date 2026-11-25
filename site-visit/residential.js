/* Residential electrical path.
   Meter, utility and service-entrance questions only appear for a service upgrade or panel replacement. */
(function(){
const S = v => v.scope || [];
const has = k => v => inc(S(v), k);
const any = (...k) => v => k.some(x => inc(S(v), x));
const SVC = any('service', 'panel');                       // service upgrade or panel replacement
const UPG = has('service');                                // bigger service
const PANELWORK = any('sub','circuits','lighting','devices','outdoor','reno','rewire','trouble','surge','code','spa');
const ADDING = any('sub','circuits','lighting','outdoor','reno','rewire','spa','surge');
const AMPS = [15,20,30,40,50,60];
const WIRE = {15:'14',20:'12',30:'10',40:'8',50:'6',60:'4'};
const SE = {100:'2 AWG Al (or 4 AWG Cu)',125:'1/0 Al (or 2 AWG Cu)',150:'2/0 Al (or 1 AWG Cu)',200:'4/0 Al (or 2/0 Cu)',320:'per design: 320 A meter, 2 × 200 A',400:'per design: 2 × 200 A'};
const FEED = {60:'4/3 Cu NM-B or 2-2-2-4 Al SER',100:'1-1-1-3 Al SER',125:'2/0-2/0-2/0-1/0 Al SER'};
const BAD = {fpe:'Federal Pacific (FPE)', zinsco:'Zinsco / Sylvania', push:'Pushmatic / Bulldog', chall:'Challenger'};
const SCOPE_T = {service:'Service upgrade', panel:'Panel replacement', sub:'Subpanel', circuits:'Circuits', lighting:'Lighting', devices:'Devices', outdoor:'Outdoor power', smart:'Smart home', reno:'Renovation', rewire:'Rewire', trouble:'Repair', surge:'Surge', code:'Code items', spa:'Hot tub / pool', other:'Other'};
const svcOpts = [['60','60 A'],['100','100 A'],['125','125 A'],['150','150 A'],['200','200 A'],['400','320/400 A'],['unk','Unknown']];

/* NEC 220.82 optional method, simplified. Preliminary only. */
const APPL = {range:['Electric range',12000],cook:['Cooktop',7200],oven:['Wall oven',5000],dryer:['Electric dryer',5000],wh:['Electric water heater',4500],hpwh:['Heat pump water heater',1000],dw:['Dishwasher',1200],disp:['Disposal',900],micro:['Built-in microwave',1500],well:['Well pump',2000],sump:['Sump pump',1000],ev:['EV charger (48 A)',11520],ev2:['2nd EV charger',11520],spa:['Hot tub',7200],pool:['Pool pump / heater',3000],shop:['Workshop / welder',5000]};
function loadCalc(v){
  const sq = num(v.lcSqft); if(!sq) return null;
  let gen = sq * 3 + 1500 * 2 + 1500;
  (v.lcAppl || []).forEach(a => gen += APPL[a] ? APPL[a][1] : 0);
  gen += num(v.lcOther) * 1000;
  const general = Math.min(gen, 10000) + Math.max(0, gen - 10000) * 0.4;
  const ac = num(v.lcAc) * 1200;
  let heat = 0;
  if(v.lcHeat === 'hp') heat = num(v.lcHpTons) * 1200 + num(v.lcStrip) * 1000 * 0.65;
  if(v.lcHeat === 'base') heat = num(v.lcHeatKw) * 1000 * (v.lcBb4 === 'yes' ? 0.4 : 0.65);
  if(v.lcHeat === 'furn') heat = num(v.lcHeatKw) * 1000 * 0.65;
  const hvac = Math.max(ac, heat), total = general + hvac, amps = total / 240;
  const sug = [100,150,200,320,400].find(s => s >= amps) || 400;
  return {gen, general, hvac, total, amps, sug};
}

const steps = [
  {title:'Job', h:'Job info', lead:'Who and where. This is shared with every other project you start on this visit.', fields: jobFields(['meterNo','utility'])},

  {title:'Scope', h:'What is the customer looking to get done?', lead:'Pick everything that applies. Each pick adds only the questions that work needs.', fields:[
    {id:'scope', type:'check', label:'Scope of work', short:'Scope', opts:[
      ['service','Service upgrade','Bigger service: new meter, panel, riser'],
      ['panel','Panel replacement','Same service size, new panel'],
      ['sub','Subpanel','Garage, addition, basement'],
      ['circuits','New circuits','Dedicated or appliance circuits'],
      ['lighting','Lighting','Recessed, fixtures, fans, under-cabinet'],
      ['devices','Outlets & switches','Replace, GFCI/AFCI, USB'],
      ['outdoor','Outdoor power','Exterior outlets, landscape, post lights'],
      ['smart','Smart home / IoT','Smart switches, doorbell, cameras, Wi-Fi'],
      ['reno','Renovation / addition','Kitchen, bath, basement, new space'],
      ['rewire','Rewire','Knob & tube or old wiring replacement'],
      ['trouble','Troubleshooting / repair','Something isn\'t working'],
      ['surge','Whole-home surge protection'],
      ['code','Code corrections','Home inspection or insurance items'],
      ['spa','Hot tub / pool'],
      ['other','Something else']]},
    {type:'note', warn:true, show:v => inc(S(v), 'service') && inc(S(v), 'panel'), text:'Both service upgrade and panel replacement picked. A service upgrade already includes the new panel; the worksheet treats it as an upgrade.'},
    {id:'scopeOther', label:'Describe the other work', show:has('other'), type:'textarea'},
    {id:'why', type:'radio', label:'What\'s driving the project?', opts:[['want','Customer wants it'],['sale','Buying / selling the home'],['ins','Insurance requirement'],['issue','Problem or safety concern'],['gc','Part of a GC\'s job']]},
    {id:'gcName', label:'General contractor', hint:'name & phone', show:v => v.why === 'gc' || has('reno')(v)},
    {id:'decider', type:'radio', label:'Decision maker present?', sm:true, opts:[['yes','Yes'],['no','No, send quote to them'],['tenant','Tenant, owner not here']]},
    {id:'timing', type:'radio', label:'When do they want it done?', opts:[['asap','ASAP'],['month','Within a month'],['flex','Flexible'],['date','By a set date']]},
    {id:'timingDate', label:'Needed by', type:'date', half:true, show:v => v.timing === 'date'},
    {id:'budget', type:'radio', label:'Budget conversation', opts:[['none','Not discussed'],['range','Gave a range'],['good','Good / better / best options wanted']]}
  ]},

  {title:'Panel', h:'Existing panel & wiring', show:v => PANELWORK(v) && !SVC(v), lead:'Enough to price breakers and know if there\'s room. Service size and meter details only come up for a service or panel job.', fields:[
    {id:'panelLoc', type:'select', label:'Panel location', half:true, opts:['Unfinished basement','Finished basement','Garage','Utility room / closet','Exterior wall','Outbuilding']},
    {id:'panelBrand', type:'select', label:'Panel brand', half:true, opts:[['sqd-hom','Square D Homeline'],['sqd-qo','Square D QO'],['eaton-br','Eaton BR'],['eaton-ch','Eaton CH'],['siemens','Siemens'],['ge','GE'],['leviton','Leviton'],['murray','Murray'],['fpe','Federal Pacific (FPE)'],['zinsco','Zinsco / Sylvania'],['push','Pushmatic / Bulldog'],['chall','Challenger'],['other','Other']]},
    {id:'spaces', type:'radio', label:'Open breaker spaces', sm:true, show:ADDING, opts:[['0','None'],['1-2','1–2'],['3-6','3–6'],['7+','7+']]},
    {id:'tandem', type:'radio', label:'Panel accepts tandem breakers?', sm:true, show:v => ADDING(v) && v.spaces === '0', opts:[['yes','Yes'],['no','No'],['unk','Check label']]},
    {id:'panelIssues', type:'check', label:'Panel condition issues', opts:[['rust','Rust / water'],['heat','Heat damage / scorching'],['double','Double taps'],['nomain','No main breaker'],['full','Full, tandems used'],['clear','Blocked working clearance'],['label','No / bad circuit directory']]},
    {id:'wiring', type:'check', label:'Wiring types seen', opts:[['nm','NM (Romex)'],['ac','BX / AC armored'],['conduit','Conduit / EMT'],['kt','Knob & tube'],['al','Aluminum branch wiring'],['cloth','Cloth-jacketed NM']]},
    {id:'panelPhotos', type:'photos', label:'Panel photos', btn:'Add panel photos', sub:'Door open (label + breakers) and the circuit directory'}
  ]},

  {title:'Service', h:'Service upgrade & panel replacement', show:SVC, lead:'Everything the utility, the inspector and the crew need for a service or panel change.', fields:[
    {type:'h', text:'Why the change'},
    {id:'svcWhy', type:'check', label:'Reasons', opts:[['brand','Problem panel brand'],['cap','Out of capacity'],['loads','Adding EV / heat pump / generator'],['damage','Storm, water or fire damage'],['ins','Insurance / home sale'],['full','Panel full'],['age','Age / obsolete parts']]},

    {type:'h', text:'Utility & meter'},
    {id:'utility', type:'radio', label:'Utility provider', visit:'utility', opts:['Central Hudson','NYSEG','National Grid','Orange & Rockland',['other','Other']]},
    {id:'utilOther', label:'Utility name', half:true, show:v => v.utility === 'other'},
    {id:'meterNo', label:'Meter #', half:true, visit:'meterNo'},
    {id:'poleNo', label:'Pole / transformer #', hint:'optional', half:true},
    {id:'acctName', label:'Name on the utility account', hint:'if not the customer', half:true},
    {id:'meterLoc', type:'select', label:'Meter location', half:true, opts:['Exterior, same wall as panel','Exterior, other wall','Detached pedestal / pole','Inside (old install)']},
    {id:'meterPhotos', type:'photos', label:'Meter photos', btn:'Add meter photos', sub:'Meter face with the number readable, and the whole socket'},

    {type:'h', text:'Existing service'},
    {id:'svcSize', type:'radio', label:'Existing service size', sm:true, visit:'svcSize', opts:svcOpts},
    {id:'svcType', type:'radio', label:'Service drop', sm:true, opts:[['oh','Overhead'],['ug','Underground']]},
    {id:'panelLoc', type:'select', label:'Panel location', half:true, opts:['Unfinished basement','Finished basement','Garage','Utility room / closet','Exterior wall','Outbuilding']},
    {id:'panelBrand', type:'select', label:'Existing panel brand', half:true, opts:[['sqd-hom','Square D Homeline'],['sqd-qo','Square D QO'],['eaton-br','Eaton BR'],['eaton-ch','Eaton CH'],['siemens','Siemens'],['ge','GE'],['leviton','Leviton'],['murray','Murray'],['fpe','Federal Pacific (FPE)'],['zinsco','Zinsco / Sylvania'],['push','Pushmatic / Bulldog'],['chall','Challenger'],['other','Other']]},
    {id:'seType', type:'radio', label:'Service entrance conductors', opts:[['seu','SEU cable'],['ser','SER cable'],['cond','Conductors in conduit'],['unk','Can\'t see']]},
    {id:'seCond', type:'radio', label:'Their condition', sm:true, opts:[['ok','Good'],['worn','Jacket cracked / worn'],['small','Undersized']]},
    {id:'mastCond', type:'radio', label:'Mast & weatherhead', show:v => v.svcType === 'oh', opts:[['ok','Good'],['lean','Leaning / loose'],['short','Too short for clearance'],['none','No mast, cable on wall']]},
    {id:'dropIssues', type:'check', label:'Service drop issues', show:v => v.svcType === 'oh', opts:[['trees','Trees in the drop'],['low','Low over roof / driveway'],['window','Near window / deck'],['attach','Bad attachment point']]},
    {id:'latCond', type:'radio', label:'Underground lateral', show:v => v.svcType === 'ug', opts:[['ok','Conduit to meter, good'],['direct','Direct-buried'],['dmg','Damaged / heaved']]},
    {id:'wiring', type:'check', label:'Branch wiring types seen', opts:[['nm','NM (Romex)'],['ac','BX / AC armored'],['conduit','Conduit / EMT'],['kt','Knob & tube'],['al','Aluminum branch wiring'],['cloth','Cloth-jacketed NM']]},
    {id:'panelIssues', type:'check', label:'Existing panel issues', opts:[['rust','Rust / water'],['heat','Heat damage / scorching'],['double','Double taps'],['nomain','No main breaker'],['full','Full, tandems used'],['clear','Blocked working clearance'],['label','No / bad circuit directory']]},

    {type:'h', text:'New equipment'},
    {id:'newSvc', type:'radio', label:'New service size', sm:true, show:UPG, opts:[['100','100 A'],['150','150 A'],['200','200 A'],['320','320 A'],['400','400 A']], def:'200'},
    {type:'note', show:v => SVC(v) && !UPG(v), text:'Panel replacement keeps the existing service size. Pick <b>Service upgrade</b> on the Scope step if the size is changing.'},
    {id:'newDrop', type:'radio', label:'New service', sm:true, show:UPG, opts:[['oh','Overhead'],['ug','Underground'],['ohug','Convert OH → UG']]},
    {id:'newSpaces', type:'radio', label:'Panel size', sm:true, opts:[['30','30 space'],['40','40 space'],['42','42 space'],['60','60 space']], def:'40'},
    {id:'panelPref', type:'select', label:'Panel brand to install', half:true, opts:['Square D Homeline','Square D QO','Eaton BR','Eaton CH','Siemens','Leviton','Span smart panel','Customer choice']},
    {id:'panelPlace', type:'radio', label:'Panel location', opts:[['same','Same spot'],['move','Relocate'],['ext','Exterior meter-main + interior panel']]},
    {id:'panelMoveTo', label:'Relocate to', hint:'and how far', show:v => v.panelPlace === 'move'},
    {id:'svcMeter', type:'radio', label:'Meter socket', sm:true, opts:[['new','Replace'],['reuse','Reuse'],['combo','Meter-main combo']], def:'new'},
    {id:'svcMast', type:'radio', label:'Mast / riser', show:v => UPG(v) ? v.newDrop === 'oh' : v.svcType === 'oh', opts:[['new','New mast & weatherhead'],['ok','Existing is fine'],['raise','Raise for clearance']]},
    {id:'seLen', label:'Service entrance cable run', hint:'ft, meter to panel', type:'number', half:true, show:v => UPG(v) || v.seCond !== 'ok' || v.panelPlace === 'move'},
    {id:'circMove', label:'Circuits to move into the new panel', type:'number', half:true},
    {id:'circExtend', label:'Circuits too short to reach', hint:'need splices / extending', type:'number', half:true},
    {id:'afciUp', label:'Circuits needing AFCI / GFCI upgrade', hint:'per AHJ', type:'number', half:true},
    {id:'svcDisc', type:'radio', label:'Exterior emergency disconnect needed?', hint:'check with the AHJ', sm:true, opts:[['yes','Yes'],['no','No'],['unk','Ask inspector']]},
    {id:'svcGen', type:'radio', label:'Prep for a generator while we\'re here?', opts:[['no','No'],['inlet','Inlet + interlock'],['standby','Standby generator','Start the Generator path too']]},

    {type:'h', text:'Grounding & bonding'},
    {id:'rods', type:'radio', label:'Ground rods', sm:true, opts:[['2','Two found'],['1','One'],['0','None found'],['unk','Can\'t tell']]},
    {id:'waterPipe', type:'radio', label:'Water service pipe', opts:[['metal','Metal, bond present'],['metalno','Metal, no bond'],['plastic','Plastic / PEX'],['well','Well, plastic line']]},
    {id:'waterDist', label:'Panel to water entry', hint:'ft', type:'number', half:true, show:v => v.waterPipe === 'metal' || v.waterPipe === 'metalno'},
    {id:'gasBond', type:'radio', label:'Gas piping', opts:[['none','No gas'],['bonded','Bonded'],['notb','Not bonded'],['csst','CSST (yellow / black flex)']]},

    {type:'h', text:'Load calculation', },
    {id:'lcDo', type:'radio', label:'Run a quick load calc?', show:UPG, opts:[['yes','Yes'],['no','Not needed'],['ev','Done in the EV path']]},
    {id:'lcSqft', label:'Living area', hint:'sq ft', type:'number', half:true, show:v => UPG(v) && v.lcDo === 'yes'},
    {id:'lcHeat', type:'radio', label:'Heating', show:v => UPG(v) && v.lcDo === 'yes', opts:[['fossil','Gas / oil / propane'],['hp','Heat pump'],['base','Electric baseboard'],['furn','Electric furnace / boiler']]},
    {id:'lcHpTons', label:'Heat pump', hint:'tons', type:'number', half:true, show:v => UPG(v) && v.lcDo === 'yes' && v.lcHeat === 'hp'},
    {id:'lcStrip', label:'Backup heat strips', hint:'kW', type:'number', half:true, show:v => UPG(v) && v.lcDo === 'yes' && v.lcHeat === 'hp'},
    {id:'lcHeatKw', label:'Electric heat total', hint:'kW', type:'number', half:true, show:v => UPG(v) && v.lcDo === 'yes' && (v.lcHeat === 'base' || v.lcHeat === 'furn')},
    {id:'lcBb4', type:'radio', label:'4 or more separately controlled heaters?', sm:true, show:v => UPG(v) && v.lcDo === 'yes' && v.lcHeat === 'base', opts:[['yes','Yes'],['no','No']]},
    {id:'lcAc', label:'Central AC', hint:'tons, 0 if none', type:'number', half:true, show:v => UPG(v) && v.lcDo === 'yes' && v.lcHeat !== 'hp'},
    {id:'lcAppl', type:'check', label:'Electric appliances & big loads', show:v => UPG(v) && v.lcDo === 'yes', opts:Object.entries(APPL).map(([k, a]) => [k, a[0], (a[1] / 1000) + ' kW'])},
    {id:'lcOther', label:'Other fixed loads', hint:'kW total', type:'number', half:true, show:v => UPG(v) && v.lcDo === 'yes'},
    {id:'lcBox', type:'calc', show:v => UPG(v) && v.lcDo === 'yes', html:v => { const c = loadCalc(v); if(!c) return ''; return `<b>Estimated demand: ${Math.round(c.total).toLocaleString()} VA ≈ ${Math.round(c.amps)} A at 240 V</b> → ${c.sug} A service covers it.<br>General loads ${Math.round(c.gen).toLocaleString()} VA → ${Math.round(c.general).toLocaleString()} VA after demand factors · HVAC ${Math.round(c.hvac).toLocaleString()} VA. NEC 220.82 optional method, simplified; confirm before submitting.`; }},

    {type:'h', text:'Outage & scheduling'},
    {id:'outage', type:'radio', label:'Outage window the customer can live with', opts:[['day','Full day OK'],['half','Half day max'],['eve','Needs power by evening']]},
    {id:'critical', type:'check', label:'Loads that can\'t go down', opts:[['well','Well pump'],['sump','Sump pump'],['freeze','Freezer / fridge'],['medical','Medical equipment'],['heat','Heat (winter)'],['office','Home office / server']]},
    {id:'tempPower', type:'radio', label:'Temporary power', show:v => (v.critical || []).length > 0, opts:[['gen','Bring a portable generator'],['cust','Customer has one'],['none','Not needed']]},
    {id:'utilWO', type:'radio', label:'Utility work order / disconnect-reconnect', sm:true, opts:[['need','Needed'],['done','Already requested'],['na','Not needed']], def:'need'},
    {id:'svcPhotos', type:'photos', label:'Service photos', btn:'Add service photos', sub:'Mast / drop or lateral, panel inside and out, grounding, water bond'}
  ]},

  {title:'Subpanel', h:'Subpanel', show:has('sub'), fields:[
    {id:'subAmps', type:'radio', label:'Subpanel size', sm:true, opts:[['60','60 A'],['100','100 A'],['125','125 A']], def:'100'},
    {id:'subSpaces', type:'radio', label:'Spaces', sm:true, opts:[['12','12'],['24','24'],['30','30']], def:'24'},
    {id:'subLoc', label:'Where it goes', half:true, ph:'e.g., detached garage'},
    {id:'subDist', label:'Feeder length', hint:'ft, panel to subpanel', type:'number', half:true},
    {id:'subUse', type:'check', label:'What it will feed', opts:[['lights','Lights & outlets'],['heat','Heater'],['shop','Tools / welder'],['ev','EV charger'],['ac','Mini-split']]},
    {id:'subRoute', type:'radio', label:'Feeder route', opts:[['in','Inside, through framing'],['surf','Surface conduit'],['ug','Underground trench']]},
    {id:'subTrench', label:'Trench length', hint:'ft', type:'number', half:true, show:v => v.subRoute === 'ug'},
    {id:'subSurface', type:'select', label:'Digging through', half:true, show:v => v.subRoute === 'ug', opts:['Lawn / soil','Gravel','Asphalt','Concrete / pavers','Ledge / rock likely']},
    {id:'subDetached', type:'radio', label:'Separate building?', sm:true, opts:[['yes','Yes'],['no','No']], hint:'needs its own ground rods'}
  ]},

  {title:'Circuits', h:'New circuits', show:has('circuits'), lead:'One card per circuit. Length is the wire route, not straight-line.', fields:[
    {id:'circ', type:'rows', label:'Circuits', rowLabel:'Circuit', add:'Add a circuit', newRow:{volts:'120', amps:'20', prot:'std'}, cols:[
      {id:'use', label:'Purpose', opts:['Kitchen countertop','Dishwasher','Disposal','Microwave','Refrigerator','Range / oven','Cooktop','Dryer','Washer','Bathroom','Mini-split / AC','Water heater','Well pump','Sump pump','Freezer','Garage / workshop','Welder / compressor','Office / computer','Exterior / landscape','Other']},
      {id:'volts', label:'Volts', opts:[['120','120 V'],['240','240 V'],['120/240','120/240 V']]},
      {id:'amps', label:'Amps', opts:AMPS.map(a => [String(a), a + ' A'])},
      {id:'len', label:'Length (ft)', type:'number', short:'Length', unit:'ft'},
      {id:'prot', label:'Protection', opts:[['std','Standard'],['afci','AFCI'],['gfci','GFCI'],['df','Dual-function']]},
      {id:'route', label:'Route', opts:['Open joists','Fish finished walls','Surface conduit','Exterior','Underground']},
      {id:'end', label:'Ends at', opts:[['rcpt','Receptacle'],['hw','Hardwired'],['disc','Disconnect']]}
    ]},
    {type:'note', text:'Charging an EV? Use the <a href="ev.html">EV charging path</a>; it runs the load calc and charger sizing.'}
  ]},

  {title:'Lighting', h:'Lighting', show:has('lighting'), fields:[
    {type:'h', text:'Recessed'},
    {id:'recN', type:'stepper', label:'New recessed lights', half:true},
    {id:'recSize', type:'radio', label:'Recessed size', sm:true, show:v => num(v.recN) > 0, opts:[['4','4"'],['6','6"']], def:'6'},
    {id:'recCeil', type:'radio', label:'Ceiling', show:v => num(v.recN) > 0, opts:[['open','Open joists','Unfinished / new construction'],['fin','Finished drywall','Fish & cut in'],['drop','Drop ceiling'],['plaster','Plaster / lath']]},
    {id:'recAttic', type:'radio', label:'Access above?', sm:true, show:v => num(v.recN) > 0 && v.recCeil !== 'open', opts:[['attic','Attic'],['floor','Finished floor'],['none','None']]},
    {id:'joistDir', type:'radio', label:'Layout vs. joists', sm:true, show:v => num(v.recN) > 0 && v.recCeil === 'fin', opts:[['with','Runs with joists'],['across','Crosses joists']]},
    {id:'ceilH', label:'Ceiling height', hint:'ft', type:'number', half:true, show:v => num(v.recN) > 0},
    {id:'cct', type:'radio', label:'Color temperature', sm:true, show:v => num(v.recN) > 0, opts:[['27','2700K'],['30','3000K'],['35','3500K'],['40','4000K'],['sel','Selectable']], def:'sel'},
    {id:'switchLegs', type:'stepper', label:'Switch locations for new lights', half:true, show:v => num(v.recN) > 0},
    {id:'dimmers', type:'radio', label:'Dimmers?', sm:true, show:v => num(v.recN) > 0, opts:[['yes','Yes'],['no','No'],['smart','Smart dimmers']]},
    {id:'newCirc', type:'radio', label:'Power from', show:v => num(v.recN) > 0, opts:[['exist','Existing lighting circuit'],['new','New circuit'],['unk','Check load']]},
    {type:'h', text:'Fixtures, fans & accent'},
    {id:'fixRepl', type:'stepper', label:'Fixtures to swap', hint:'existing box', half:true},
    {id:'fixNew', type:'stepper', label:'New fixture locations', half:true},
    {id:'heavy', type:'radio', label:'Chandelier / heavy fixture?', sm:true, show:v => num(v.fixRepl) + num(v.fixNew) > 0, opts:[['no','No'],['yes','Yes, over 50 lb or high ceiling']]},
    {id:'fanN', type:'stepper', label:'Ceiling fans', half:true},
    {id:'fanBox', type:'radio', label:'Fan-rated box at the fan spot?', sm:true, show:v => num(v.fanN) > 0, opts:[['yes','Yes'],['no','No'],['new','New location']]},
    {id:'fanCtl', type:'radio', label:'Fan control', show:v => num(v.fanN) > 0, opts:[['pull','Pull chain / remote'],['sep','Separate fan + light switches'],['smart','Smart fan control']]},
    {id:'ucFt', label:'Under-cabinet lighting', hint:'ft of cabinet', type:'number', half:true},
    {id:'ucType', type:'radio', label:'Under-cabinet type', show:v => num(v.ucFt) > 0, opts:[['tape','LED tape + driver'],['puck','Pucks'],['bar','Hardwired bars']]},
    {id:'extN', type:'stepper', label:'Exterior / flood lights', half:true},
    {id:'extCtl', type:'check', label:'Exterior control', show:v => num(v.extN) > 0, opts:[['motion','Motion'],['dusk','Dusk-to-dawn'],['timer','Timer'],['smart','Smart / app']]},
    {id:'custSupplies', type:'radio', label:'Who supplies fixtures?', opts:[['ea','ElectricAce'],['cust','Customer'],['mix','Mix']]}
  ]},

  {title:'Devices', h:'Outlets & switches', show:has('devices'), fields:[
    {id:'recpt', type:'stepper', label:'Receptacles to replace', half:true},
    {id:'gfci', type:'stepper', label:'GFCI receptacles', half:true},
    {id:'usb', type:'stepper', label:'USB receptacles', half:true},
    {id:'newRecpt', type:'stepper', label:'New receptacle locations', half:true},
    {id:'sw', type:'stepper', label:'Switches to replace', half:true},
    {id:'sw3', type:'stepper', label:'3-way / 4-way switches', half:true},
    {id:'afciBkr', type:'stepper', label:'AFCI / dual-function breakers', half:true},
    {id:'devColor', type:'radio', label:'Device style & color', opts:[['dec-w','Decora, white'],['dec-lt','Decora, light almond'],['dec-b','Decora, black'],['tog','Toggle / duplex'],['other','Other']]},
    {id:'twoProng', type:'radio', label:'Ungrounded (2-prong) outlets?', opts:[['no','No'],['some','Some'],['most','Most of the house']]},
    {id:'boxes', type:'radio', label:'Box condition', opts:[['ok','Good, room for devices'],['shallow','Shallow / crowded'],['metal','Old metal, no ground']]}
  ]},

  {title:'Outdoor', h:'Outdoor power', show:has('outdoor'), fields:[
    {id:'outRec', type:'stepper', label:'Weatherproof GFCI receptacles', half:true},
    {id:'soffit', type:'stepper', label:'Soffit / holiday receptacles', half:true},
    {id:'post', type:'stepper', label:'Post / lamp lights', half:true},
    {id:'landXf', type:'radio', label:'Landscape lighting', opts:[['no','No'],['xf','Transformer only'],['full','Transformer + fixtures']]},
    {id:'landN', type:'stepper', label:'Landscape fixtures', half:true, show:v => v.landXf === 'full'},
    {id:'outDist', label:'Longest run from the house', hint:'ft', type:'number', half:true},
    {id:'outTrench', label:'Trench length', hint:'ft', type:'number', half:true},
    {id:'outSurface', type:'select', label:'Digging through', half:true, show:v => num(v.outTrench) > 0, opts:['Lawn / soil','Gravel','Asphalt','Concrete / pavers','Garden beds','Ledge / rock likely']}
  ]},

  {title:'Smart home', h:'Smart home & IoT', show:has('smart'), lead:'What they want controlled, and what the house can support.', fields:[
    {id:'platform', type:'radio', label:'Platform', opts:[['caseta','Lutron Caséta'],['ra3','Lutron RA3'],['google','Google Home'],['alexa','Amazon Alexa'],['apple','Apple Home'],['st','SmartThings'],['ha','Home Assistant'],['c4','Control4'],['none','Undecided']]},
    {id:'smartSw', type:'stepper', label:'Smart switches', half:true},
    {id:'smartDim', type:'stepper', label:'Smart dimmers', half:true},
    {id:'neutral', type:'radio', label:'Neutral in the switch boxes?', show:v => num(v.smartSw) + num(v.smartDim) > 0, opts:[['yes','Yes'],['some','Some boxes'],['no','No'],['unk','Didn\'t check']]},
    {id:'smartItems', type:'check', label:'Other devices', opts:[['tstat','Smart thermostat'],['bell','Video doorbell'],['cam','Cameras'],['lock','Smart lock'],['mesh','Wi-Fi mesh / network'],['monitor','Energy monitor','Sense, Emporia'],['span','Smart panel'],['shades','Motorized shades'],['leak','Leak / freeze sensors'],['spk','Speakers / AV'],['garage','Garage door controller']]},
    {id:'camN', type:'stepper', label:'Cameras', half:true, show:v => inc(v.smartItems, 'cam')},
    {id:'camPower', type:'radio', label:'Camera power', show:v => inc(v.smartItems, 'cam'), opts:[['poe','PoE (Cat6)'],['wired','Hardwired 120 V'],['batt','Battery / solar']]},
    {id:'cat6', label:'Cat6 per camera', hint:'ft, average', type:'number', half:true, show:v => inc(v.smartItems, 'cam') && v.camPower === 'poe'},
    {id:'meshN', type:'stepper', label:'Mesh nodes / access points', half:true, show:v => inc(v.smartItems, 'mesh')},
    {id:'bellXfmr', type:'radio', label:'Doorbell transformer', show:v => inc(v.smartItems, 'bell'), opts:[['ok','Existing works'],['new','Replace (16 V / 30 VA)'],['none','No existing doorbell']]},
    {id:'tstatC', type:'radio', label:'C-wire at the thermostat?', sm:true, show:v => inc(v.smartItems, 'tstat'), opts:[['yes','Yes'],['no','No'],['unk','Unknown']]},
    {id:'wifi', type:'radio', label:'Wi-Fi at the device locations', opts:[['good','Strong everywhere'],['weak','Weak spots'],['none','No coverage at some']]},
    {id:'netLoc', label:'Router / network location', ph:'e.g., basement office'},
    {id:'smartSetup', type:'radio', label:'App setup & training', opts:[['ea','We set up and walk them through'],['cust','Customer handles it']]}
  ]},

  {title:'Renovation', h:'Renovation / addition', show:has('reno'), fields:[
    {id:'renoArea', type:'check', label:'Area', opts:[['kitchen','Kitchen'],['bath','Bathroom'],['bsmt','Basement'],['add','Addition'],['garage','Garage'],['attic','Attic / bonus room']]},
    {id:'renoSqft', label:'Square footage', type:'number', half:true},
    {id:'renoRooms', label:'Rooms', type:'number', half:true},
    {id:'renoWalls', type:'radio', label:'Walls & ceilings', opts:[['open','Open framing'],['closed','Finished, fish wire'],['mix','Mix']]},
    {id:'plans', type:'radio', label:'Plans / drawings?', sm:true, opts:[['yes','Yes'],['no','No'],['coming','Coming']]},
    {id:'renoRecpt', type:'stepper', label:'New receptacles', half:true},
    {id:'renoSw', type:'stepper', label:'New switches', half:true},
    {id:'renoLights', type:'stepper', label:'New light locations', half:true},
    {id:'smokeN', type:'stepper', label:'Smoke / CO alarms', hint:'hardwired, interconnected', half:true},
    {id:'kitCounter', type:'stepper', label:'Countertop receptacles', half:true, show:v => inc(v.renoArea, 'kitchen')},
    {id:'island', type:'radio', label:'Island / peninsula power', sm:true, show:v => inc(v.renoArea, 'kitchen'), opts:[['no','None'],['pop','Pop-up'],['side','Side-mount'],['floor','Floor box']]},
    {id:'kitAppl', type:'check', label:'Kitchen appliance circuits', show:v => inc(v.renoArea, 'kitchen'), opts:[['range','Range / oven'],['cook','Cooktop'],['dw','Dishwasher'],['disp','Disposal'],['micro','Microwave'],['fridge','Refrigerator'],['hood','Hood']]},
    {id:'bathFan', type:'stepper', label:'Bath exhaust fans', half:true, show:v => inc(v.renoArea, 'bath')},
    {id:'bathHeat', type:'radio', label:'Bath extras', show:v => inc(v.renoArea, 'bath'), opts:[['none','None'],['floor','Heated floor'],['mirror','Lighted mirror'],['both','Both']]},
    {id:'phases', type:'radio', label:'Phases', opts:[['both','Rough-in + finish'],['rough','Rough-in only'],['finish','Finish only']]}
  ]},

  {title:'Rewire', h:'Rewire', show:has('rewire'), lead:'Rough scope for replacing old wiring.', fields:[
    {id:'rwExtent', type:'radio', label:'Extent', opts:[['whole','Whole house'],['floor','One floor'],['rooms','Specific rooms']]},
    {id:'rwRooms', label:'Rooms included', type:'number', half:true},
    {id:'rwSqft', label:'Square footage', type:'number', half:true},
    {id:'rwFloors', type:'radio', label:'Floors', sm:true, opts:[['1','1'],['2','2'],['3','3+']]},
    {id:'rwWalls', type:'radio', label:'Wall finish', opts:[['drywall','Drywall'],['plaster','Plaster & lath'],['open','Open (gut reno)']]},
    {id:'ktLive', type:'radio', label:'Knob & tube still live?', sm:true, opts:[['yes','Yes'],['some','Some'],['no','No / abandoned'],['unk','Unknown']]},
    {id:'ktInsul', type:'radio', label:'Insulation over the K&T?', sm:true, show:v => v.ktLive === 'yes' || v.ktLive === 'some', opts:[['no','No'],['yes','Yes'],['unk','Can\'t see']]},
    {id:'rwPaths', type:'check', label:'Routes available', opts:[['attic','Attic above'],['bsmt','Basement below'],['chase','Closets / chases'],['base','Behind baseboards']]}
  ]},

  {title:'Troubleshoot', h:'Troubleshooting / repair', show:has('trouble'), fields:[
    {id:'symptom', type:'check', label:'Symptoms', opts:[['dead','Dead outlets / lights'],['trip','Breaker keeps tripping'],['flicker','Flickering / dimming'],['smell','Burning smell / scorching'],['shock','Shock or tingle'],['half','Half the house out'],['hot','Warm outlet / switch / panel'],['buzz','Buzzing'],['bright','Lights get brighter / dimmer']]},
    {id:'symWhere', label:'Where in the house', ph:'e.g., kitchen and dining room'},
    {id:'symSince', label:'Since when / what changed', ph:'storm, new appliance, recent work…'},
    {type:'h', text:'Readings'},
    {id:'vL1N', label:'L1–N', hint:'V', type:'number', half:true},
    {id:'vL2N', label:'L2–N', hint:'V', type:'number', half:true},
    {id:'vL1L2', label:'L1–L2', hint:'V', type:'number', half:true},
    {id:'vNG', label:'N–G at the problem spot', hint:'V', type:'number', half:true},
    {id:'symFound', type:'textarea', label:'What you found', ph:'Cause, repair made or recommended'},
    {id:'symFixed', type:'radio', label:'Status', opts:[['fixed','Fixed today'],['quote','Needs a quote'],['util','Utility issue, customer to call']]}
  ]},

  {title:'Surge', h:'Whole-home surge protection', show:has('surge'), fields:[
    {id:'spdType', type:'radio', label:'Device', opts:[['bkr','Plug-in breaker SPD','Matches panel brand'],['ext','External Type 1/2 SPD','Mounted beside the panel'],['meter','Meter-base SPD','If the utility allows']]},
    {id:'spdPou', type:'stepper', label:'Point-of-use surge strips / outlets', half:true},
    {id:'spdComm', type:'check', label:'Also protect', opts:[['coax','Coax / cable'],['phone','Phone / DSL'],['hvac','HVAC equipment']]}
  ]},

  {title:'Code items', h:'Code corrections', show:has('code'), fields:[
    {id:'codeSrc', type:'radio', label:'Source', opts:[['insp','Home inspection report'],['ins','Insurance carrier'],['ahj','Building dept / inspector'],['util','Utility']]},
    {id:'codeDue', label:'Deadline / closing date', type:'date', half:true},
    {id:'codeItems', type:'textarea', label:'Items to correct', ph:'One per line, as written in the report'},
    {id:'codePhotos', type:'photos', label:'Report pages & problem spots', btn:'Add photos of the report / items'}
  ]},

  {title:'Hot tub / pool', h:'Hot tub / pool', show:has('spa'), fields:[
    {id:'spaKind', type:'check', label:'Equipment', opts:[['tub','Hot tub / spa'],['pump','Pool pump'],['heater','Pool heater / heat pump'],['light','Pool lights'],['bond','Pool bonding']]},
    {id:'spaAmps', type:'radio', label:'Hot tub circuit', sm:true, show:v => inc(v.spaKind, 'tub'), opts:[['40','40 A'],['50','50 A'],['60','60 A']], def:'50'},
    {id:'spaDist', label:'Panel to equipment', hint:'ft', type:'number', half:true},
    {id:'spaOut', label:'Of that, outdoors / underground', hint:'ft', type:'number', half:true},
    {id:'spaModel', label:'Make & model', ph:'from the spec sheet'},
    {id:'spaPad', type:'radio', label:'Pad / deck', opts:[['pad','Concrete pad'],['deck','On a deck'],['ground','At grade / pavers']]}
  ]},

  {title:'Site', h:'Access & site', lead:'Anything that changes time on the job.', fields:[
    {id:'access', type:'check', label:'Access', opts:[['attic','Attic access'],['crawl','Crawlspace'],['unfin','Unfinished basement'],['fin','Finished basement'],['slab','Slab on grade'],['plaster','Plaster walls'],['tall','Ceilings over 10 ft'],['pets','Pets on site']]},
    {id:'patch', type:'radio', label:'Patching & painting by', opts:[['cust','Customer'],['gc','GC'],['ea','ElectricAce']]},
    {id:'permit', type:'radio', label:'Permit & inspection', opts:[['yes','Needed'],['no','Not needed'],['unk','Check with town']]},
    {id:'inspAgency', type:'select', label:'Inspection agency', half:true, show:v => v.permit === 'yes', opts:['Commonwealth Electrical Inspection','Middle Department Inspection Agency','Atlantic Inland','Town / village inspector','Other']},
    {id:'town', label:'Town / municipality', half:true, show:v => v.permit === 'yes'},
    {id:'crew', type:'radio', label:'Crew', sm:true, opts:[['1','1'],['2','2'],['3','3+']]},
    {id:'days', label:'Estimated days on site', type:'number', half:true},
    {id:'sitePhotos', type:'photos', label:'Work-area photos', btn:'Add work-area photos'},
    {id:'notes', type:'textarea', label:'Notes for the estimate', ph:'Customer priorities, budget, anything else'}
  ]}
];

function review(v, ctx){
  const notes = [], mats = [], brand = v.panelBrand, svc = SVC(v), upg = UPG(v);
  const util = v.utility === 'other' ? (v.utilOther || 'the utility') : (v.utility || 'the utility');
  const bkrSpec = svc && v.panelPref ? 'Match new panel: ' + v.panelPref : (brand && !BAD[brand] ? 'Match panel' : 'Match panel brand');
  const it = (cat, key, name, spec, qty, unit) => { if(qty > 0){ let g = mats.find(x => x.cat === cat); if(!g) mats.push(g = {cat, items:[]}); const e = g.items.find(x => x.key === key); if(e) e.qty += qty; else g.items.push({key, name, spec, qty, unit}); } };

  // existing-condition flags
  if(BAD[brand]) notes.push(['warn', `${BAD[brand]} panel. ${svc ? 'Being replaced; note it on the permit.' : 'Recommend replacement and quote it as an option.'}`]);
  if(inc(v.wiring, 'kt')) notes.push(['warn', 'Knob & tube present. Many insurers flag it; note where it\'s live and quote replacement.']);
  if(inc(v.wiring, 'al')) notes.push(['warn', 'Aluminum branch wiring. Use AlumiConn / CO/ALR devices at every connection touched.']);
  if(inc(v.panelIssues, 'heat') || inc(v.symptom, 'smell') || inc(v.symptom, 'hot')) notes.push(['warn', 'Signs of overheating. Treat as a safety item and tell the customer before leaving.']);
  if(inc(v.symptom, 'shock')) notes.push(['warn', 'Shock / tingle reported. Check bonding and grounding before anything else.']);
  if(inc(v.symptom, 'bright') || (num(v.vL1N) && num(v.vL2N) && Math.abs(num(v.vL1N) - num(v.vL2N)) > 8)) notes.push(['warn', `Unbalanced voltage${num(v.vL1N) ? ` (L1–N ${v.vL1N} V, L2–N ${v.vL2N} V)` : ''}. Suspect a lost or loose neutral; check the service neutral and call ${util} if it's on their side.`]);
  if(inc(v.panelIssues, 'double')) notes.push(['info', 'Double taps found. Add pigtails or breakers to correct.']);
  if(v.twoProng === 'most' || v.twoProng === 'some') notes.push(['info', 'Ungrounded outlets: GFCI-protect them and label "No equipment ground", or run new grounds.']);
  if(ADDING(v) && !svc && v.spaces === '0') notes.push(['warn', v.tandem === 'yes' ? 'Panel is full; tandems are allowed. Confirm the listed tandem count.' : 'Panel is full. Plan a subpanel, or quote a panel replacement.']);

  // service upgrade / panel replacement
  if(svc){
    const exist = +v.svcSize || 200, a = upg ? (+v.newSvc || 200) : exist, sp = v.newSpaces || '40';
    if(!upg && v.svcSize === 'unk') notes.push(['warn', 'Existing service size unknown. Confirm it before ordering a same-size panel.']);
    if(upg && exist && a <= exist && v.svcSize !== 'unk') notes.push(['warn', `New size (${a} A) isn't bigger than the existing ${exist} A. Pick Panel replacement instead, or change the size.`]);
    it('Service', 'svc-panel', `${a >= 320 ? '200 A' : a + ' A'} main breaker load center`, `${sp} space · ${v.panelPref || 'brand TBD'}${a >= 320 ? ' (×2 for 320/400 A)' : ''}`, a >= 320 ? 2 : 1);
    if(v.panelPlace === 'ext') it('Service', 'svc-mm', `${a} A meter-main (exterior)`, `Per ${util} spec · interior panel becomes main-lug`, 1);
    if(v.svcMeter !== 'reuse' && v.panelPlace !== 'ext') it('Service', 'svc-meter', v.svcMeter === 'combo' ? `${a} A meter-main combo` : `${a >= 320 ? '320 A' : a + ' A'} meter socket`, `Per ${util} spec`, 1);
    if(upg || v.seCond !== 'ok' || v.panelPlace === 'move') it('Service', 'svc-se', 'Service entrance conductors', SE[a] || SE[200], Math.max(10, num(v.seLen) + 6), 'ft');
    const ohNew = upg ? v.newDrop === 'oh' : v.svcType === 'oh';
    if(ohNew && (v.svcMast === 'new' || v.svcMast === 'raise' || v.mastCond === 'lean' || v.mastCond === 'short' || v.mastCond === 'none')) it('Service', 'svc-mast', 'Mast kit + weatherhead', '2" rigid, roof flashing, brace', 1, 'kit');
    if(upg && v.newDrop === 'ohug') it('Service', 'svc-ug', 'PVC Sch 80 riser + sweep', '2" or per utility', 1, 'set');
    const rodsNeed = v.rods === '2' ? 0 : v.rods === '1' ? 1 : 2;
    it('Grounding', 'svc-rod', 'Ground rod 5/8" × 8\'', rodsNeed < 2 ? 'Add to existing' : '', rodsNeed);
    it('Grounding', 'svc-acorn', 'Acorn ground clamp', '', rodsNeed + (v.waterPipe === 'metalno' ? 1 : 0));
    it('Grounding', 'svc-gec', 'Bare Cu grounding electrode conductor', '#6 to rods; water pipe size per NEC 250.66', (rodsNeed ? 20 : 0) + (v.waterPipe === 'metalno' || v.waterPipe === 'metal' ? Math.max(10, num(v.waterDist) + 5) : 0), 'ft');
    if(v.waterPipe === 'metalno') it('Grounding', 'svc-wbond', 'Water pipe ground clamp + jumper', 'Within 5 ft of entry, jump the meter', 1);
    if(v.gasBond === 'csst') it('Grounding', 'svc-csst', 'CSST bonding clamp', 'Per manufacturer, #6 Cu', 1);
    if(v.gasBond === 'notb') it('Grounding', 'svc-gas', 'Gas pipe bonding clamp', '', 1);
    it('Grounding', 'svc-ibb', 'Intersystem bonding bridge', '', 1);
    it('Service', 'svc-spd', 'Type 1 or 2 surge protective device', 'Required on service replacement where NEC 2020+ applies (230.67)', inc(S(v), 'surge') ? 0 : 1);
    it('Service', 'svc-bkr', 'Branch breakers to re-land circuits', bkrSpec, Math.max(num(v.circMove) - num(v.afciUp), 0));
    it('Service', 'svc-afci', 'AFCI / dual-function breakers', bkrSpec + ' · upgraded circuits', num(v.afciUp));
    it('Service', 'svc-ext', 'Splice kits / junction boxes for short circuits', 'Plus matching NM to extend', num(v.circExtend));
    if(v.svcDisc === 'yes') it('Service', 'svc-disc', 'Exterior emergency disconnect', `${a} A, service rated`, 1);
    if(v.svcGen === 'inlet') it('Service', 'svc-inlet', 'Generator inlet box + interlock kit', '30 or 50 A, match panel', 1, 'kit');
    if(v.svcGen === 'standby') notes.push(['info', 'Standby generator wanted. Start the Generator installation path for this visit too.']);
    if(v.utilWO !== 'na' && v.utilWO !== 'done') notes.push(['warn', `Request the ${util} work order for disconnect / reconnect${v.meterNo ? ' (meter #' + v.meterNo + ')' : ''}.`]);
    if(!v.meterNo && !ctx.photos('meterPhotos')) notes.push(['info', 'No meter # yet. Get it or a clear meter photo for the utility paperwork.']);
    if(v.acctName) notes.push(['info', 'Utility account is in the name of ' + v.acctName + '; they may need to authorize the work order.']);
    if(inc(v.dropIssues, 'trees')) notes.push(['info', `Trees in the service drop. Ask ${util} about trimming before the cutover.`]);
    if(inc(v.dropIssues, 'low') || v.mastCond === 'short') notes.push(['info', 'Drop clearance is low. Raise the mast or relocate the attachment point.']);
    if(v.latCond === 'dmg') notes.push(['warn', `Underground lateral is damaged. Coordinate repair with ${util}.`]);
    if(v.gasBond === 'csst') notes.push(['info', 'CSST gas piping: bond it per the manufacturer\'s instructions.']);
    if(v.panelPlace === 'move') notes.push(['info', 'Panel relocation: every circuit will need extending to the new spot. Price splices and labor.']);
    if((v.critical || []).length && v.tempPower === 'gen') it('Service', 'svc-temp', 'Temporary power: portable generator + cords', 'For critical loads during the cutover', 1, 'set');
    if(inc(v.critical, 'medical')) notes.push(['warn', 'Medical equipment in the home. Schedule the outage with the customer and arrange backup power.']);
    if(v.outage === 'eve' || v.outage === 'half') notes.push(['info', 'Short outage window. Pre-build the panel and stage the crew to cut over fast.']);
    if(upg && v.lcDo === 'yes'){
      const c = loadCalc(v);
      if(c){ notes.push([c.sug > a ? 'warn' : 'info', `Load calc ≈ ${Math.round(c.amps)} A demand → ${c.sug} A service covers it${c.sug > a ? `; ${a} A is too small` : ''}. Preliminary.`]); }
    }
    notes.push(['info', 'Permit and inspection required for a service or panel change.']);
  }

  // subpanel
  if(inc(S(v), 'sub')){
    const a = +v.subAmps || 100;
    it('Subpanel', 'sub-panel', `${a} A main-lug subpanel`, (v.subSpaces || 24) + ' space', 1);
    it('Subpanel', 'sub-gb', 'Ground bar kit', 'Neutrals and grounds separated', 1);
    it('Subpanel', 'sub-bkr', `${a} A 2-pole feeder breaker`, bkrSpec, 1);
    it('Subpanel', 'sub-feed', 'Feeder', FEED[a] + (v.subRoute === 'ug' ? ' (rated for wet location / in conduit)' : ''), Math.max(10, Math.ceil(num(v.subDist) * 1.1 + 8)), 'ft');
    if(v.subRoute === 'ug'){ it('Subpanel', 'sub-pvc', 'PVC Sch 40 conduit', a > 60 ? '1-1/2"' : '1-1/4"', Math.ceil(num(v.subTrench) || num(v.subDist)), 'ft'); it('Subpanel', 'sub-sweep', 'PVC sweeps / LBs', '', 2); notes.push(['info', 'Underground feeder: 18" cover for PVC under lawn, 24" for direct-burial cable. Call 811 before digging.']); }
    if(v.subDetached === 'yes'){ it('Subpanel', 'sub-rod', 'Ground rod 5/8" × 8\'', 'Separate building', 2); it('Subpanel', 'sub-dis', 'Main breaker or disconnect at the building', '', 1); }
    if(inc(v.subUse, 'ev')) notes.push(['info', 'EV charger on the subpanel. Run the EV path to size the feeder for it.']);
  }
  // circuits
  (v.circ || []).forEach(r => {
    const a = +r.amps || 20, poles = r.volts === '120' ? 1 : 2, cond = r.volts === '120/240' ? 3 : 2, g = WIRE[a] || '12';
    const len = Math.ceil(num(r.len) * 1.1 + 10);
    const ext = r.route === 'Exterior' || r.route === 'Underground';
    it('Circuits', `bkr-${a}-${poles}-${r.prot}`, `${a} A ${poles}-pole breaker${r.prot && r.prot !== 'std' ? ' — ' + ({afci:'AFCI', gfci:'GFCI', df:'Dual-function'})[r.prot] : ''}`, bkrSpec, 1);
    it('Circuits', `w-${g}-${cond}-${ext ? 'uf' : 'nm'}`, `${g}/${cond} w/ground ${ext ? 'UF-B' : 'NM-B'}`, ext ? 'Exterior / buried' : '', len, 'ft');
    if(r.route === 'Surface conduit' || r.route === 'Exterior') it('Circuits', 'c-conduit', 'Conduit + fittings', '1/2"–3/4" EMT or PVC', Math.ceil(num(r.len) * .5), 'ft');
    if(r.use === 'Range / oven' || r.use === 'Dryer') it('Circuits', `rcpt-${a}`, `${a} A receptacle${r.use === 'Dryer' ? ' (NEMA 14-30)' : ' (NEMA 14-50)'}`, '4-wire', 1);
    else if(r.end === 'rcpt') it('Circuits', `rc-${a}-${poles}`, `${a} A ${poles === 1 ? '' : '240 V '}receptacle + box`, '', 1);
    if(r.end === 'disc') it('Circuits', `disc-${a}`, `${a <= 60 ? '60' : a} A disconnect`, 'Non-fused', 1);
  });
  // lighting
  if(inc(S(v), 'lighting')){
    const n = num(v.recN), fin = v.recCeil && v.recCeil !== 'open';
    it('Lighting', 'l-rec', `${v.recSize || 6}" LED canless / wafer light`, `IC-rated, ${v.cct === 'sel' || !v.cct ? '5CCT selectable' : v.cct + '00K'}, with J-box`, n);
    it('Lighting', 'l-wire', '14/2 w/ground NM-B', 'Light-to-light + home runs', n ? n * 8 + 25 * Math.max(1, num(v.switchLegs)) : 0, 'ft');
    it('Lighting', 'l-dim', v.dimmers === 'smart' ? 'Smart dimmer' : 'LED-compatible dimmer', '', n && v.dimmers && v.dimmers !== 'no' ? Math.max(1, num(v.switchLegs)) : 0);
    it('Lighting', 'l-sw', 'Single-pole switch', '', n && v.dimmers === 'no' ? Math.max(1, num(v.switchLegs)) : 0);
    it('Lighting', 'l-swbox', fin ? 'Old-work switch box' : 'New-work switch box', '', n ? Math.max(1, num(v.switchLegs)) : 0);
    it('Lighting', 'l-fixbox', fin ? 'Old-work ceiling box' : 'New-work ceiling box', 'New fixture locations', num(v.fixNew));
    it('Lighting', 'l-fixw', '14/2 w/ground NM-B', 'New fixture locations', num(v.fixNew) * 20, 'ft');
    if(v.heavy === 'yes') it('Lighting', 'l-heavy', 'Heavy-fixture rated box / brace', '', 1);
    it('Lighting', 'l-fanbox', v.fanBox === 'new' || !fin ? 'Fan-rated box' : 'Old-work fan brace + box', '', v.fanBox === 'yes' ? 0 : num(v.fanN));
    if(v.fanCtl === 'sep') it('Lighting', 'l-fanw', '14/3 w/ground NM-B', 'Separate fan / light control', num(v.fanN) * 20, 'ft');
    if(v.fanCtl === 'smart') it('Lighting', 'l-fanc', 'Smart fan control', '', num(v.fanN));
    if(num(v.ucFt)){
      if(v.ucType === 'puck') it('Lighting', 'l-uc', 'LED puck light', '', Math.ceil(num(v.ucFt) / 1.5));
      else if(v.ucType === 'bar') it('Lighting', 'l-uc', 'Hardwired LED under-cabinet bar', '', Math.ceil(num(v.ucFt) / 2));
      else { it('Lighting', 'l-uc', 'LED tape + aluminum channel', '', Math.ceil(num(v.ucFt) + 2), 'ft'); it('Lighting', 'l-ucd', 'LED driver (dimmable)', 'Size to tape wattage', 1); }
    }
    it('Lighting', 'l-ext', 'Weatherproof box + cover', 'For exterior fixtures', num(v.extN));
    if(inc(v.extCtl, 'motion')) it('Lighting', 'l-mot', 'Motion sensor', '', num(v.extN));
    if(inc(v.extCtl, 'dusk')) it('Lighting', 'l-dusk', 'Photocell / dusk-to-dawn control', '', 1);
    if(n && v.recCeil === 'plaster') notes.push(['warn', 'Plaster & lath ceiling: expect slower cutting and more patching. Price accordingly.']);
    if(n && fin && v.recAttic === 'none') notes.push(['info', 'No access above a finished ceiling. Plan fish routes; extra holes and patching likely.']);
    if(n && v.joistDir === 'across') notes.push(['info', 'Light layout crosses joists. Drill-through or extra cut-ins; allow more time.']);
    if(n && v.newCirc === 'new') it('Lighting', 'l-bkr', '15 A breaker — AFCI', bkrSpec, 1);
    if(num(v.ceilH) > 10 || v.heavy === 'yes') notes.push(['info', 'High ceiling or heavy fixture. Bring the tall ladder or scaffold and a second person.']);
  }
  // devices
  if(inc(S(v), 'devices')){
    const style = v.devColor === 'tog' ? 'duplex' : 'Decora', color = {'dec-lt':'Light almond','dec-b':'Black'}[v.devColor] || 'White';
    it('Devices', 'd-rec', `15 A tamper-resistant ${style} receptacle`, color, num(v.recpt) + num(v.newRecpt));
    it('Devices', 'd-gfci', '15 A self-test GFCI receptacle', 'Tamper-resistant · ' + color, num(v.gfci));
    it('Devices', 'd-usb', 'USB-A/C receptacle', color, num(v.usb));
    it('Devices', 'd-sw', `15 A ${style === 'Decora' ? 'Decora' : 'toggle'} switch`, color, num(v.sw));
    it('Devices', 'd-sw3', '3-way / 4-way switch', color, num(v.sw3));
    it('Devices', 'd-afci', 'AFCI / dual-function breaker', bkrSpec, num(v.afciBkr));
    it('Devices', 'd-plate', 'Wall plates', 'Screwless where Decora', num(v.recpt) + num(v.newRecpt) + num(v.gfci) + num(v.usb) + num(v.sw) + num(v.sw3));
    it('Devices', 'd-box', 'Old-work box', 'For new locations', num(v.newRecpt));
    it('Devices', 'd-ext', 'Box extender / deep old-work box', 'Crowded boxes', v.boxes === 'shallow' ? Math.ceil((num(v.recpt) + num(v.sw)) / 3) : 0);
    it('Devices', 'd-wire', '14/2 or 12/2 NM-B', 'Match circuit, new locations', num(v.newRecpt) * 15, 'ft');
  }
  // outdoor
  if(inc(S(v), 'outdoor')){
    it('Outdoor', 'o-rec', 'WR GFCI receptacle + in-use cover + box', '', num(v.outRec));
    it('Outdoor', 'o-sof', 'Soffit receptacle + box', 'Switched or on a timer', num(v.soffit));
    it('Outdoor', 'o-post', 'Lamp post + photocell', 'Customer fixture?', num(v.post));
    if(v.landXf !== 'no' && v.landXf) it('Outdoor', 'o-xf', 'Low-voltage landscape transformer', 'With timer / photocell', 1);
    if(v.landXf === 'full'){ it('Outdoor', 'o-land', 'Landscape fixture', '', num(v.landN)); it('Outdoor', 'o-lv', '12/2 low-voltage landscape cable', '', num(v.landN) * 15 + 25, 'ft'); }
    it('Outdoor', 'o-uf', '12/2 w/ground UF-B', 'Line-voltage runs', num(v.outDist) ? Math.ceil(num(v.outDist) * 1.1 + 10) : 0, 'ft');
    it('Outdoor', 'o-pvc', 'PVC Sch 40 conduit + sweeps', 'Where cable leaves the house / under paving', num(v.outTrench) ? Math.ceil(num(v.outTrench) * .3) + 10 : 0, 'ft');
    if(num(v.outTrench)) notes.push(['info', `Trenching ${v.outTrench} ft${v.outSurface ? ' through ' + v.outSurface.toLowerCase() : ''}. Call 811 first.`]);
  }
  // smart home
  if(inc(S(v), 'smart')){
    const P = {caseta:'Lutron Caséta', ra3:'Lutron RA3', google:'Google-compatible', alexa:'Alexa-compatible', apple:'Matter / HomeKit', st:'SmartThings', ha:'Z-Wave / Zigbee', c4:'Control4'}[v.platform] || 'Platform TBD';
    it('Smart home', 's-sw', 'Smart switch', P, num(v.smartSw));
    it('Smart home', 's-dim', 'Smart dimmer', P, num(v.smartDim));
    if(v.platform === 'caseta' && num(v.smartSw) + num(v.smartDim)) it('Smart home', 's-hub', 'Lutron Smart Bridge', '', 1);
    if(v.platform === 'ra3') it('Smart home', 's-hub', 'Lutron RA3 processor', '', 1);
    if(inc(v.smartItems, 'tstat')) it('Smart home', 's-tstat', 'Smart thermostat', v.tstatC === 'no' ? 'Needs C-wire adapter or new cable' : '', 1);
    if(inc(v.smartItems, 'bell')) it('Smart home', 's-bell', 'Video doorbell', '', 1);
    if(v.bellXfmr === 'new' || v.bellXfmr === 'none') it('Smart home', 's-xf', 'Doorbell transformer', '16 V / 30 VA', 1);
    if(inc(v.smartItems, 'cam')) it('Smart home', 's-cam', 'Camera', v.camPower === 'poe' ? 'PoE' : v.camPower === 'wired' ? '120 V' : 'Battery / solar', num(v.camN));
    if(v.camPower === 'poe' && num(v.camN)){ it('Smart home', 's-cat6', 'Cat6 cable', 'Outdoor-rated where exposed', Math.ceil(num(v.camN) * (num(v.cat6) || 75)), 'ft'); it('Smart home', 's-poe', 'PoE switch / NVR', `${num(v.camN) > 4 ? 8 : 4}+ ports`, 1); }
    if(inc(v.smartItems, 'mesh')) it('Smart home', 's-mesh', 'Mesh node / access point', '', num(v.meshN) || 2);
    if(inc(v.smartItems, 'monitor')) it('Smart home', 's-mon', 'Whole-home energy monitor', 'CTs in main panel', 1);
    if(inc(v.smartItems, 'leak')) it('Smart home', 's-leak', 'Leak / freeze sensor', '', 3);
    if(inc(v.smartItems, 'garage')) it('Smart home', 's-gar', 'Smart garage door controller', '', 1);
    if(v.neutral === 'no' || v.neutral === 'some') notes.push(['info', 'No neutral in some switch boxes. Use no-neutral devices (e.g., Lutron Caséta dimmers) or plan new cable.']);
    if(v.wifi && v.wifi !== 'good') notes.push(['info', 'Weak Wi-Fi at device locations. Quote mesh / access points or a hub-based (Clear Connect, Z-Wave) platform.']);
    if(inc(v.smartItems, 'span') && !svc) notes.push(['info', 'Smart panel wanted. That\'s a panel replacement; add it to the scope to get the service questions.']);
  }
  // renovation
  if(inc(S(v), 'reno')){
    const r = num(v.renoRecpt), s = num(v.renoSw), l = num(v.renoLights), k = num(v.kitCounter);
    const nb = v.renoWalls === 'closed' ? 'Old-work' : 'New-work';
    it('Renovation', 'r-box', `${nb} device box`, '', r + s + k);
    it('Renovation', 'r-cbox', `${nb} ceiling box`, '', l);
    it('Renovation', 'r-rec', '15/20 A tamper-resistant receptacle', '', r);
    it('Renovation', 'r-gfci', '20 A GFCI receptacle', 'Countertop', k ? Math.ceil(k / 2) : 0);
    it('Renovation', 'r-krec', '20 A tamper-resistant receptacle', 'Countertop, load side', k ? k - Math.ceil(k / 2) : 0);
    if(v.island && v.island !== 'no') it('Renovation', 'r-isl', ({pop:'Countertop pop-up receptacle', side:'Side-mount island receptacle', floor:'Floor box + receptacle'})[v.island], '20 A, GFCI-protected', 1);
    it('Renovation', 'r-sw', 'Switch', '', s);
    it('Renovation', 'r-smoke', 'Hardwired smoke / CO combo alarm', 'Interconnected, battery backup', num(v.smokeN));
    it('Renovation', 'r-fan', 'Bath exhaust fan', 'Vented to exterior', num(v.bathFan));
    if(v.bathHeat === 'floor' || v.bathHeat === 'both') it('Renovation', 'r-floor', 'Heated floor thermostat (GFCI)', 'Mat by flooring installer?', 1);
    if(v.bathHeat === 'mirror' || v.bathHeat === 'both') it('Renovation', 'r-mirror', 'Recessed box for lighted mirror', '', 1);
    it('Renovation', 'r-14', '14/2 w/ground NM-B', 'Lighting', l * 12 + s * 10, 'ft');
    it('Renovation', 'r-12', '12/2 w/ground NM-B', 'Receptacles & 20 A circuits', (r + k) * 15, 'ft');
    if(inc(v.renoArea, 'kitchen')){
      it('Renovation', 'r-sabc', '20 A breaker — small appliance', bkrSpec + '; AFCI/GFCI as required', 2);
      (v.kitAppl || []).forEach(x => { const m = {range:['50 A 2-pole breaker','6/3 NM-B',50,'Range'], cook:['40 A 2-pole breaker','8/3 NM-B',40,'Cooktop'], dw:['20 A breaker','12/2 NM-B',30,'Dishwasher'], disp:['20 A breaker','12/2 NM-B',30,'Disposal'], micro:['20 A breaker','12/2 NM-B',30,'Microwave'], fridge:['20 A breaker','12/2 NM-B',30,'Refrigerator'], hood:['15 A breaker','14/2 NM-B',30,'Hood']}[x]; if(!m) return; it('Renovation', 'r-kb-' + x, m[0] + ' — ' + m[3], bkrSpec, 1); it('Renovation', 'r-kw-' + m[1], m[1], 'Kitchen appliance runs', m[2], 'ft'); });
    }
    if(v.plans !== 'yes') notes.push(['info', 'No plans yet. Walk the layout with the customer and confirm device counts before pricing.']);
    if(v.gcName) notes.push(['info', 'GC: ' + v.gcName + '. Confirm rough-in schedule and who handles patching.']);
  }
  // rewire (rough: per room ≈ 4 receptacles, 1 switch, 1 light)
  if(inc(S(v), 'rewire')){
    const rooms = num(v.rwRooms) || Math.ceil(num(v.rwSqft) / 200), old = v.rwWalls !== 'open';
    it('Rewire', 'rw-rec', '15 A tamper-resistant receptacle', 'Rough count, 4 per room', rooms * 4);
    it('Rewire', 'rw-sw', 'Switch', '1 per room', rooms);
    it('Rewire', 'rw-box', old ? 'Old-work device box' : 'New-work device box', '', rooms * 5);
    it('Rewire', 'rw-cbox', old ? 'Old-work ceiling box' : 'New-work ceiling box', '', rooms);
    it('Rewire', 'rw-12', '12/2 w/ground NM-B', 'Receptacle circuits', rooms * 60, 'ft');
    it('Rewire', 'rw-14', '14/2 w/ground NM-B', 'Lighting circuits', rooms * 40, 'ft');
    it('Rewire', 'rw-afci', 'AFCI / dual-function breaker', bkrSpec, Math.ceil(rooms / 2));
    it('Rewire', 'rw-smoke', 'Hardwired smoke / CO combo alarm', 'Likely required with a rewire', Math.max(2, Math.ceil(rooms / 3)));
    if(v.ktLive === 'yes' || v.ktLive === 'some') notes.push(['warn', 'Live knob & tube. Disconnect it at the panel as each circuit is replaced; leave abandoned runs dead and tagged.']);
    if(v.ktInsul === 'yes') notes.push(['warn', 'Insulation over live knob & tube is a fire risk. Prioritize those runs.']);
    if(v.rwWalls === 'plaster') notes.push(['info', 'Plaster walls: fishing is slow and patching heavy. Settle who patches before pricing.']);
    notes.push(['info', 'Rewire counts are rough (4 receptacles, 1 switch, 1 light per room). Walk each room to refine.']);
  }
  // surge
  if(inc(S(v), 'surge')){
    it('Surge', 'spd', v.spdType === 'ext' ? 'Type 1/2 whole-home SPD' : v.spdType === 'meter' ? 'Meter-base SPD' : 'Plug-in breaker SPD', v.spdType === 'meter' ? 'Utility approval required' : 'Match panel', 1);
    it('Surge', 'spd-pou', 'Point-of-use surge device', '', num(v.spdPou));
    it('Surge', 'spd-coax', 'Coax / phone line surge protector', '', inc(v.spdComm, 'coax') || inc(v.spdComm, 'phone') ? 1 : 0);
  }
  // spa / pool
  if(inc(S(v), 'spa')){
    if(inc(v.spaKind, 'tub')){
      const a = +v.spaAmps || 50, g = WIRE[a];
      it('Hot tub / pool', 'spa-disc', `${a} A GFCI spa disconnect`, 'At least 5 ft from the tub, in sight of it', 1);
      it('Hot tub / pool', 'spa-bkr', `${a} A 2-pole breaker`, bkrSpec, 1);
      it('Hot tub / pool', 'spa-w', `${g} AWG Cu, 4-wire with insulated ground`, 'NM-B inside; THHN in conduit outside', Math.ceil(num(v.spaDist) * 1.1 + 10), 'ft');
      it('Hot tub / pool', 'spa-whip', 'Liquidtight whip', 'Disconnect to tub', 1);
    }
    it('Hot tub / pool', 'spa-pvc', 'PVC Sch 40 conduit', '3/4"–1"', Math.ceil(num(v.spaOut)), 'ft');
    if(inc(v.spaKind, 'bond')) it('Hot tub / pool', 'spa-bond', '#8 solid bare Cu bonding conductor', 'Equipotential bonding', 60, 'ft');
    if(num(v.spaOut)) notes.push(['info', 'Call 811 before trenching for the hot tub / pool feed.']);
  }
  if(inc(S(v), 'code') && v.codeDue) notes.push(['warn', 'Code items due by ' + new Date(v.codeDue + 'T12:00').toLocaleDateString() + '.']);
  if(v.symFixed === 'util') notes.push(['info', `Problem is on the utility side. Customer to call ${util}.`]);
  if(v.decider === 'no' || v.decider === 'tenant') notes.push(['info', 'Decision maker wasn\'t here. Send the quote to them directly.']);
  if(v.permit === 'unk') notes.push(['info', 'Confirm permit requirement with ' + (v.town || 'the town') + '.']);
  it('Consumables', 'cons', 'Wire nuts, staples, connectors, tape', 'Stock', mats.length ? 1 : 0, 'lot');

  const nCirc = (v.circ || []).length, wire = mats.flatMap(g => g.items).filter(i => i.unit === 'ft' && /NM|UF|AWG|SER|Cu|Cat6|conductor|cable/i.test(i.name)).reduce((a, i) => a + i.qty, 0);
  const hero = [['Scope', S(v).length + '<small> area' + (S(v).length === 1 ? '' : 's') + '</small>', S(v).map(x => SCOPE_T[x]).join(' · ')]];
  if(svc){
    const ex = v.svcSize && v.svcSize !== 'unk' ? (v.svcSize === '400' ? '320/400' : v.svcSize) : '?';
    hero.push([upg ? 'Service upgrade' : 'Panel replacement', upg ? `${ex}→${v.newSvc || 200}<small> A</small>` : `${ex}<small> A</small>`, (v.newSpaces || 40) + ' space · ' + (v.panelPref || 'brand TBD')]);
  } else {
    const dev = mats.flatMap(g => g.items).filter(i => (i.unit || 'ea') === 'ea' && /receptacle|switch|dimmer|light|fan|GFCI|USB|alarm/i.test(i.name)).reduce((a, i) => a + i.qty, 0);
    hero.push(['Devices & fixtures', Math.round(dev) + '<small> ea</small>', nCirc ? nCirc + ' new circuit' + (nCirc > 1 ? 's' : '') : 'From the takeoff below']);
  }
  hero.push(['Wire & cable', Math.round(wire).toLocaleString() + '<small> ft</small>', nCirc ? nCirc + ' new circuit' + (nCirc > 1 ? 's' : '') : 'Estimated']);
  return {hero, notes, mats};
}

Wiz({id:'residential', title:'Residential Electrical', store:'ea-res-v1', steps, review, summary: v => S(v).map(x => SCOPE_T[x]).join(', ')});
})();

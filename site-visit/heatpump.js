/* Heat pump installation path */
(function(){
const FACTOR = {poor:35, avg:28, good:22, tight:16};
const SIZES = [9000,12000,15000,18000,24000,30000,36000,48000];
const k = b => (b / 1000) + 'k';
const pick = btu => SIZES.find(s => s >= btu * 0.95) || 48000;
const lineFor = b => b <= 12000 ? '1/4" × 3/8"' : b <= 18000 ? '1/4" × 1/2"' : '3/8" × 5/8"';
const WIRE = mca => mca <= 15 ? '14' : mca <= 20 ? '12' : mca <= 30 ? '10' : mca <= 40 ? '8' : '6';
const factor = v => FACTOR[v.envelope] || 28;
const sqft = v => num(v.sqft);
const zoneBtu = (v, z) => z.size && z.size !== 'auto' ? +z.size : (num(z.sqft) ? pick(num(z.sqft) * factor(v)) : 0);
const zones = v => (v.zones || []).filter(z => z.room || z.sqft || (z.size && z.size !== 'auto'));
const ducted = v => v.sysType === 'ducted' || v.sysType === 'slim';

const steps = [
  {title:'Job', h:'Job info', lead:'Who and where. This is shared with every other project you start on this visit.', fields: jobFields()},

  {title:'Project', h:'What kind of heat pump job is it?', fields:[
    {id:'sysType', type:'radio', label:'System type', opts:[['single','Ductless, single zone','One indoor head'],['multi','Ductless, multi-zone','2–5 heads on one outdoor unit'],['ducted','Ducted, central','Air handler on ductwork'],['slim','Slim-duct / concealed','Short-run ducted heads'],['mixed','Mixed','Ducted + ductless']]},
    {id:'goal', type:'radio', label:'Goal', opts:[['whole','Whole-home heating','Primary heat source'],['partial','Part of the home','Zones / additions'],['supp','Supplemental heat'],['cool','Mostly cooling','Replacing window units / AC']]},
    {id:'existHeat', type:'radio', label:'Existing heat', opts:[['oil','Oil'],['lp','Propane'],['ng','Natural gas'],['elec','Electric baseboard'],['wood','Wood / pellet'],['none','None']]},
    {id:'keepBackup', type:'radio', label:'Keep the existing system as backup?', sm:true, show:v => v.existHeat && !['none','elec'].includes(v.existHeat), opts:[['yes','Yes'],['no','No, remove'],['unk','Undecided']]},
    {id:'existAC', type:'radio', label:'Existing cooling', opts:[['none','None'],['window','Window units'],['central','Central AC'],['mini','Older mini-splits']]},
    {id:'ductCond', type:'radio', label:'Ductwork', show:ducted, opts:[['good','Existing, good shape'],['fix','Existing, needs work'],['new','New ductwork needed']]},
    {id:'brand', type:'select', label:'Equipment brand', half:true, opts:['Cooper & Hunter','Mitsubishi','Fujitsu','Daikin','LG','Gree','Carrier / Bryant','Customer choice']},
    {id:'incentive', type:'radio', label:'Incentive', opts:[['clean','NYS Clean Heat (through the utility)'],['none','No incentive'],['unk','Customer wants to know']]},
    {id:'manJ', type:'radio', label:'Load calculation', opts:[['done','Manual J done'],['need','Need one'],['rough','Rough estimate is fine']]}
  ]},

  {title:'Home', h:'The house', lead:'Used for a rough heat-loss number. Confirm with a Manual J before committing to equipment.', fields:[
    {id:'sqft', label:'Conditioned square footage', type:'number', half:true},
    {id:'levels', type:'radio', label:'Levels', sm:true, half:true, opts:[['1','1'],['2','2'],['3','3+']]},
    {id:'envelope', type:'radio', label:'Insulation & air sealing', opts:[['poor','Poor','Older, drafty, little insulation'],['avg','Average','Some updates'],['good','Good','Updated windows & insulation'],['tight','Tight / new build','Recent code or better']], def:'avg'},
    {id:'bsmt', type:'radio', label:'Basement', opts:[['cond','Conditioned / finished'],['uncond','Unconditioned'],['slab','Slab / crawl']]},
    {id:'calcHome', type:'calc', html:v => sqft(v) ? `<b>Rough design heat loss: ${Math.round(sqft(v) * factor(v)).toLocaleString()} BTU/h</b> (${sqft(v).toLocaleString()} sq ft × ${factor(v)} BTU/sq ft, ${({poor:'poor',avg:'average',good:'good',tight:'tight'})[v.envelope] || 'average'} envelope). Rule of thumb only.` : ''}
  ]},

  {title:'Zones', h:'Indoor units', lead:'One card per indoor head or air handler. Leave size on Auto to size from square footage.', fields:[
    {id:'zones', type:'rows', label:'Zones', rowLabel:'Zone', add:'Add a zone', newRow:{type:'wall', size:'auto', cond:'gravity', wall:'ext'}, cols:[
      {id:'room', label:'Room / area', ph:'e.g., Living room'},
      {id:'sqft', label:'Sq ft', type:'number', unit:'sq ft'},
      {id:'type', label:'Head type', opts:[['wall','Wall mount'],['cassette','Ceiling cassette'],['floor','Floor console'],['slim','Slim duct'],['ahu','Air handler']]},
      {id:'size', label:'Size', opts:[['auto','Auto'], ...SIZES.map(s => [String(s), k(s) + ' BTU'])]},
      {id:'ls', label:'Line set (ft)', type:'number', short:'Line set', unit:'ft'},
      {id:'cond', label:'Condensate', opts:[['gravity','Gravity'],['pump','Pump']]},
      {id:'wall', label:'Mounted on', opts:[['ext','Exterior wall'],['int','Interior wall']]}
    ]},
    {id:'calcZones', type:'calc', html:v => { const z = zones(v); if(!z.length) return ''; const t = z.reduce((a, r) => a + zoneBtu(v, r), 0); const hl = sqft(v) * factor(v); return `<b>Connected indoor capacity: ${t.toLocaleString()} BTU/h</b> across ${z.length} zone${z.length > 1 ? 's' : ''}` + (hl ? ` · house estimate ${Math.round(hl).toLocaleString()} BTU/h` : '') + '<br>' + z.map(r => `${r.room || 'Zone'}: ${k(zoneBtu(v, r))}${!r.size || r.size === 'auto' ? ' (auto)' : ''}`).join(' · '); }},
    {type:'note', warn:true, show:v => v.sysType === 'multi' && zones(v).length > 5, text:'More than 5 heads. Most multi-zone outdoor units top out at 5 ports; plan a second outdoor unit.'}
  ]},

  {title:'Outdoor unit', h:'Outdoor unit', fields:[
    {id:'oduN', type:'stepper', label:'Outdoor units', half:true, def:1},
    {id:'oduSide', type:'radio', label:'Side of the house', sm:true, opts:[['A','A · Front'],['B','B · Left'],['C','C · Rear'],['D','D · Right']]},
    {id:'mount', type:'radio', label:'Mounting', opts:[['stand','Ground stand','Raised above snow'],['pad','Pad at grade'],['wall','Wall bracket'],['roof','Roof / flat roof']], def:'stand'},
    {id:'standH', type:'radio', label:'Stand height', sm:true, show:v => v.mount === 'stand', opts:[['12','12"'],['18','18"'],['24','24"']], def:'18'},
    {id:'drip', type:'radio', label:'Under a roof drip line?', sm:true, opts:[['no','No'],['yes','Yes'],['gutter','Gutter above']]},
    {id:'wallCon', type:'radio', label:'Wall construction at penetrations', opts:[['wood','Wood frame / siding'],['brick','Brick veneer'],['stone','Stone'],['block','Block / concrete'],['stucco','Stucco']]},
    {id:'lhOut', label:'Line hide on the outside', hint:'ft total', type:'number', half:true},
    {id:'lhIn', label:'Line hide inside', hint:'ft total', type:'number', half:true},
    {id:'clearOk', type:'radio', label:'Clearances OK?', hint:'from windows, vents, gas meter, dryer vent', opts:[['yes','Yes'],['no','Tight, check manual']]},
    {id:'oduPhotos', type:'photos', label:'Outdoor unit location & line route', btn:'Add outdoor photos'}
  ]},

  {title:'Electrical', h:'Electrical', lead:'Take MCA / MOCP from the outdoor unit spec sheet.', fields:[
    {id:'svcSize', type:'radio', label:'Main service', sm:true, opts:[['60','60 A'],['100','100 A'],['125','125 A'],['150','150 A'],['200','200 A'],['400','320/400 A']], visit:'svcSize'},
    {id:'spaces', type:'radio', label:'Open breaker spaces', sm:true, opts:[['0','None'],['1-2','1–2'],['3-6','3–6'],['7+','7+']]},
    {id:'panelBrand', type:'select', label:'Panel brand', half:true, opts:['Square D Homeline','Square D QO','Eaton BR','Eaton CH','Siemens','GE','Leviton','Murray','Federal Pacific (FPE)','Zinsco','Other']},
    {id:'panelLoc', type:'select', label:'Panel location', half:true, opts:['Unfinished basement','Finished basement','Garage','Utility room','Exterior wall']},
    {id:'mca', label:'MCA', hint:'amps, per outdoor unit', type:'number', half:true},
    {id:'mocp', type:'select', label:'MOCP / breaker', half:true, opts:['15','20','25','30','35','40','45','50','60'].map(a => [a, a + ' A'])},
    {id:'runLen', label:'Panel to disconnect', hint:'ft, along the route', type:'number', half:true},
    {id:'runRoute', type:'radio', label:'Circuit route', opts:[['in','Inside, open joists'],['fish','Fish finished space'],['out','Exterior conduit'],['ug','Underground']]},
    {id:'svcRec', type:'radio', label:'Receptacle within 25 ft of the outdoor unit?', hint:'NEC 210.63 service receptacle', sm:true, opts:[['yes','Yes'],['no','No, add one']]},
    {id:'controls', type:'check', label:'Controls', opts:[['remote','Handheld remotes'],['wall','Wired wall controllers'],['wifi','Wi-Fi adapters'],['tstat','Thermostat (ducted)']]},
    {id:'elecHeat', type:'radio', label:'Electric heat staying in the house?', sm:true, opts:[['no','No'],['some','Some'],['all','All baseboard stays']]}
  ]},

  {title:'Site', h:'Access & notes', fields:[
    {id:'access', type:'check', label:'Access', opts:[['attic','Attic for line sets'],['bsmt','Basement chase'],['closet','Closet chase'],['tall','2nd-story exterior run'],['pets','Pets on site']]},
    {id:'lift', type:'radio', label:'Lift needed?', sm:true, opts:[['no','No'],['ladder','Extension ladder'],['lift','Lift / staging']]},
    {id:'removal', type:'radio', label:'Old equipment removal', opts:[['none','None'],['window','Window units'],['ac','Old AC / mini-split','Recover refrigerant'],['boiler','Fossil system']]},
    {id:'permit', type:'radio', label:'Permit & inspection', opts:[['yes','Needed'],['no','Not needed'],['unk','Check with town']]},
    {id:'indoorPhotos', type:'photos', label:'Indoor head locations', btn:'Add indoor photos'},
    {id:'notes', type:'textarea', label:'Notes for the estimate', ph:'Comfort complaints, budget, anything else'}
  ]}
];

function review(v){
  const notes = [], mats = [];
  const it = (cat, key, name, spec, qty, unit) => { if(qty > 0){ let g = mats.find(x => x.cat === cat); if(!g) mats.push(g = {cat, items:[]}); const e = g.items.find(x => x.key === key); if(e) e.qty += qty; else g.items.push({key, name, spec, qty, unit}); } };
  const Z = zones(v), conn = Z.reduce((a, r) => a + zoneBtu(v, r), 0), hl = Math.round(sqft(v) * factor(v)), odus = Math.max(1, num(v.oduN) || 1);
  const brand = v.brand || 'brand TBD';

  // equipment
  if(v.sysType === 'multi' || (v.sysType === 'mixed' && Z.length > 1)){
    const per = Math.ceil(Z.length / odus);
    it('Equipment', 'odu', 'Multi-zone outdoor unit', `${brand} · ${per}-zone · ~${k(pick(conn / odus))} BTU each`, odus);
  } else {
    Z.forEach(z => it('Equipment', 'odu-' + zoneBtu(v, z), `Outdoor unit ${k(zoneBtu(v, z))} BTU`, brand + ' · match indoor unit', 1));
    if(!Z.length) it('Equipment', 'odu', 'Outdoor unit', brand + ' · size TBD', odus);
  }
  Z.forEach(z => { const b = zoneBtu(v, z), t = ({wall:'Wall-mount head', cassette:'Ceiling cassette', floor:'Floor console', slim:'Slim-duct unit', ahu:'Air handler'})[z.type] || 'Indoor unit'; it('Equipment', `idu-${z.type}-${b}`, `${t} ${k(b)} BTU`, brand, 1); });

  // refrigerant & condensate
  Z.forEach(z => {
    const b = zoneBtu(v, z), L = num(z.ls) || 25;
    it('Line sets', 'ls-' + lineFor(b), `Line set ${lineFor(b)}, insulated`, 'Verify size with install manual', L + 3, 'ft');
    it('Line sets', 'ic', '14/4 stranded interconnect cable', 'Outdoor to indoor; check manual', L + 5, 'ft');
    it('Line sets', 'sleeve', 'Wall sleeve / penetration cap', '3" hole', 1);
    if(z.cond === 'pump') it('Line sets', 'cpump', 'Mini-split condensate pump', 'Line-hide or in-wall', 1);
    it('Line sets', 'cline', '5/8" condensate drain line', '', z.cond === 'pump' ? 20 : Math.max(10, Math.round(L / 2)), 'ft');
  });
  if(Z.some(z => num(z.ls) > 25)) notes.push(['info', 'One or more line sets run past 25 ft. Check the unit\'s pre-charged length and add refrigerant per the manual.']);
  if(num(v.lhOut)){ it('Line hide', 'lh-out', 'Line hide channel (exterior)', '3" or 4", color to match siding', Math.ceil(num(v.lhOut) / 6.5), '6.5 ft pc'); it('Line hide', 'lh-fit', 'Line hide fittings', 'Wall inlet, elbows, couplers, end', Math.max(3, Z.length * 3)); }
  if(num(v.lhIn)) it('Line hide', 'lh-in', 'Line hide channel (interior)', '2-3/4", white', Math.ceil(num(v.lhIn) / 6.5), '6.5 ft pc');

  // mounting
  if(v.mount === 'stand') it('Mounting', 'stand', `Outdoor unit stand ${v.standH || 18}"`, 'Composite or galvanized, with anti-vibration feet', odus);
  if(v.mount === 'pad') it('Mounting', 'pad', 'Equipment pad', 'Sized to unit + riser feet', odus);
  if(v.mount === 'wall') it('Mounting', 'bracket', 'Wall bracket', 'Rated for unit weight; masonry anchors as needed', odus);
  if(v.mount === 'roof') it('Mounting', 'roofstand', 'Roof stand / sleepers', '', odus);
  if(v.drip === 'yes' || v.drip === 'gutter') it('Mounting', 'drip', 'Snow / drip shield (top cover)', '', odus);
  if(v.mount === 'pad') notes.push(['warn', 'Unit at grade. Hudson Valley snow will bury it; recommend a stand at 12–24".']);
  if(v.drip === 'yes') notes.push(['info', 'Unit under a drip line. Add a shield or move it to keep ice off the coil.']);

  // electrical
  const mocp = +v.mocp || 0, mca = num(v.mca) || (mocp ? mocp * 0.8 : 0);
  if(mocp){
    const g = WIRE(mca), ext = v.runRoute === 'out' || v.runRoute === 'ug';
    it('Electrical', 'bkr', `${mocp} A 2-pole breaker`, (v.panelBrand ? 'Match ' + v.panelBrand : 'Match panel') + ' · per ODU', odus);
    it('Electrical', 'wire', `${g}/2 w/ground ${ext ? 'UF-B or THHN in conduit' : 'NM-B'}`, `Sized for ${mca ? mca + ' A MCA' : 'MOCP'}`, Math.ceil((num(v.runLen) || 25) * 1.1 + 8) * odus, 'ft');
  } else notes.push(['info', 'Breaker size not set. Take MCA / MOCP from the outdoor unit spec sheet.']);
  it('Electrical', 'disc', 'AC disconnect', mocp > 60 ? 'Sized per nameplate' : '60 A non-fused pullout (fused if the nameplate calls for fuses)', odus);
  it('Electrical', 'whip', 'Liquidtight whip', '1/2"–3/4" × 6 ft', odus);
  if(v.runRoute === 'out' || v.runRoute === 'ug') it('Electrical', 'conduit', 'Conduit + fittings', 'PVC or EMT', Math.ceil((num(v.runLen) || 20) * .6), 'ft');
  if(v.svcRec === 'no'){ it('Electrical', 'svcrec', 'Weather-resistant GFCI receptacle', 'With in-use cover, within 25 ft of the unit', 1); it('Electrical', 'svcbox', 'Weatherproof box', '', 1); }
  if(inc(v.controls, 'wall')) it('Electrical', 'wallctl', 'Wired wall controller', brand, Z.length || 1);
  if(inc(v.controls, 'wifi')) it('Electrical', 'wifi', 'Wi-Fi adapter', brand, Z.length || 1);
  if(inc(v.controls, 'tstat')) it('Electrical', 'tstat', 'Thermostat + 18/8 cable', 'Ducted system', 1);
  const svc = +v.svcSize;
  if(svc && svc <= 100 && (v.goal === 'whole' || conn >= 36000)) notes.push(['warn', `${svc} A service with ${conn >= 36000 ? k(conn) + ' BTU of heat pump' : 'whole-home heat pump'}. Run a load calculation; a service upgrade may be needed.`]);
  if(v.spaces === '0') notes.push(['warn', 'No open breaker spaces. Plan tandems (if listed) or a subpanel.']);
  if(/FPE|Zinsco|Federal/.test(v.panelBrand || '')) notes.push(['warn', 'Federal Pacific / Zinsco panel. Quote panel replacement with the job.']);

  // sizing notes
  if(hl && conn){
    if(v.goal === 'whole' && conn < hl * 0.9) notes.push(['warn', `Connected capacity (${conn.toLocaleString()} BTU/h) is under the rough heat loss (${hl.toLocaleString()} BTU/h) for whole-home heating. Confirm with Manual J or keep backup heat.`]);
    if(conn > hl * 1.5) notes.push(['info', 'Connected capacity is well over the estimated heat loss. Check for oversizing (short cycling).']);
  }
  if(v.goal === 'whole') notes.push(['info', 'Whole-home heating: specify cold-climate rated equipment.']);
  if(v.incentive === 'clean' || v.incentive === 'unk') notes.push(['info', 'Confirm NYS Clean Heat eligibility and sizing requirements with the utility program before quoting incentive amounts.']);
  if(v.manJ === 'need') notes.push(['info', 'Manual J needed before final equipment selection.']);
  if(['brick','stone','block','stucco'].includes(v.wallCon)) notes.push(['info', 'Masonry / stucco penetrations: bring the core bit and allow extra time.']);
  if(v.removal === 'ac') notes.push(['info', 'Old refrigerant equipment: recover refrigerant before removal.']);
  if(v.lift === 'lift') notes.push(['info', 'Lift / staging needed; book it with the install date.']);

  it('Consumables', 'cons', 'Flare nuts, Nylog, foam, UV tape, mastic, anchors', 'Stock', mats.length ? 1 : 0, 'lot');
  it('Consumables', 'n2', 'Nitrogen (pressure test) & vacuum to 500 microns', 'Shop', mats.length ? 1 : 0, 'job');

  const hero = [
    ['Rough heat loss', hl ? Math.round(hl / 1000) + '<small>k BTU/h</small>' : '—', sqft(v) ? sqft(v).toLocaleString() + ' sq ft' : 'Enter square footage'],
    ['Connected capacity', conn ? Math.round(conn / 1000) + '<small>k BTU/h</small>' : '—', Z.length ? Z.length + ' indoor unit' + (Z.length > 1 ? 's' : '') + ' · ' + odus + ' outdoor' : 'Add zones'],
    ['Circuit', mocp ? mocp + '<small> A 2-pole</small>' : '—', mocp ? WIRE(mca) + ' AWG · ' + (num(v.runLen) || '?') + ' ft run' : 'From spec sheet']
  ];
  return {hero, notes, mats};
}

Wiz({id:'heatpump', title:'Heat Pump Installation', store:'ea-hp-v1', steps, review, summary: v => [({single:'Ductless single zone', multi:'Ductless multi-zone', ducted:'Ducted', slim:'Slim-duct', mixed:'Mixed'})[v.sysType], zones(v).length ? zones(v).length + ' zone' + (zones(v).length > 1 ? 's' : '') : ''].filter(Boolean).join(', ')});
})();

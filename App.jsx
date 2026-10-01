import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Printer, Settings } from 'lucide-react';

export default function App() {
  const [formulas, setFormulas] = useState([]);
  const [activeTab, setActiveTab] = useState('preweigh'); // 'preweigh', 'missing', 'refer'
  const [logoBase64, setLogoBase64] = useState(null);
  
  const [fontScale, setFontScale] = useState(100);

  const [formData, setFormData] = useState({
    date: '',
    formula: '',
    name: '',
    batch: '',
    po: '',
    batches: '',
    palletNum: '1',
    palletTotal: '1',
    ile: 'ILE',
    identifier: '',
    missing1: '',
    missing2: '',
    missing3: '',
    missing4: '',
    refer1: '',
    refer2: '',
    refer3: '',
    refer4: ''
  });

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear().toString().slice(-2);
    let mm = today.getMonth() + 1; 
    let dd = today.getDate();
    if (mm < 10) mm = '0' + mm;
    if (dd < 10) dd = '0' + dd;
    setFormData(prev => ({ ...prev, date: `${mm}/${dd}/${yyyy}` }));
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setFormulas(results.data);
          alert(`¡${results.data.length} fórmulas cargadas correctamente!`);
        }
      });
    }
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setLogoBase64(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleFormulaChange = (e) => {
    const searchVal = e.target.value;
    setFormData(prev => ({ ...prev, formula: searchVal }));
    
    const match = formulas.find(f => f.Formula === searchVal);
    if (match) {
      setFormData(prev => ({
        ...prev,
        name: match.Name || '',
        identifier: match.Identifier || '',
        ile: match.ILE || 'ILE'
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="flex h-screen bg-gray-200 overflow-hidden font-sans">
      
      {/* PANEL IZQUIERDO */}
      <div className="w-[400px] bg-white shadow-xl flex flex-col no-print z-10 border-r border-gray-300">
        <div className="p-6 bg-[#6B52FF] text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight">
              <Settings size={26} /> Label Master
            </h1>
            <p className="text-purple-200 text-sm mt-1 font-medium">Pre-weigh System</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-bold text-gray-800 mb-2">1. Base de Datos (CSV)</label>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
            <p className="text-xs text-gray-500 mt-2 font-medium">Fórmulas listas: {formulas.length}</p>
          </div>

          <div className="grid gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">2. Formato de Etiqueta</label>
              <select 
                value={activeTab} 
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border font-medium text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="preweigh">Preweigh Pallet Tag</option>
                <option value="missing">Preweigh Pallet Missing</option>
                <option value="refer">Keep in Refer - Ingredients</option>
              </select>
            </div>
            
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <label className="block text-sm font-bold text-gray-800 mb-1 flex justify-between">
                <span>Zoom / Escala Global</span>
                <span className="text-purple-600">{fontScale}%</span>
              </label>
              <input 
                type="range" 
                min="85" max="115" 
                value={fontScale} 
                onChange={(e) => setFontScale(e.target.value)} 
                className="w-full accent-purple-600 cursor-pointer" 
              />
            </div>
          </div>

          <hr className="border-gray-200" />

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">3. Ingreso de Datos</label>
            <div className="grid gap-3">
              {(activeTab === 'preweigh' || activeTab === 'refer') && (
                <input type="text" name="formula" placeholder="Formula (Ej: 300577)" value={formData.formula} onChange={handleFormulaChange} className="w-full p-2.5 border rounded-md font-bold focus:ring-2 focus:ring-purple-500 outline-none" />
              )}
              
              <input type="text" name="name" placeholder="Name..." value={formData.name} onChange={handleChange} className="w-full p-2.5 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold" />
              
              <div className="flex gap-2">
                <input type="text" name="batch" placeholder="Batch#" value={formData.batch} onChange={handleChange} className="w-1/2 p-2.5 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none font-bold" />
                <input type="text" name="batches" placeholder="Batches (Ej. 3/19)" value={formData.batches} onChange={handleChange} className="w-1/2 p-2.5 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none font-bold" />
              </div>
              
              {activeTab !== 'refer' && (
                <>
                  <input type="text" name="po" placeholder="P.O.#" value={formData.po} onChange={handleChange} className="w-full p-2.5 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none font-bold" />
                  
                  <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-md border border-gray-200 mt-1">
                    <span className="text-sm font-bold text-gray-600">Pallet Num:</span>
                    <input type="text" name="palletNum" value={formData.palletNum} onChange={handleChange} className="w-12 p-1.5 border rounded text-center font-bold" />
                    <span className="text-sm font-bold text-gray-600">of</span>
                    <input type="text" name="palletTotal" value={formData.palletTotal} onChange={handleChange} className="w-12 p-1.5 border rounded text-center font-bold" />
                  </div>
                </>
              )}

              {/* Ingredientes Faltantes (Solo Missing) */}
              {activeTab === 'missing' && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md grid gap-2">
                  <p className="text-xs font-bold text-red-600 uppercase mb-1">Ingredientes Faltantes</p>
                  {[1, 2, 3, 4].map(num => (
                    <input key={`m${num}`} type="text" name={`missing${num}`} placeholder={`Missing ${num}...`} value={formData[`missing${num}`]} onChange={handleChange} className="w-full p-2 border border-red-300 rounded text-sm focus:ring-red-500 outline-none font-bold" />
                  ))}
                </div>
              )}

              {/* Ingredientes Refrigerados (Solo Refer) */}
              {activeTab === 'refer' && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md grid gap-2">
                  <p className="text-xs font-bold text-blue-600 uppercase mb-1">Ingredientes Refrigerados</p>
                  {[1, 2, 3, 4].map(num => (
                    <input key={`r${num}`} type="text" name={`refer${num}`} placeholder={`Refer Item ${num}...`} value={formData[`refer${num}`]} onChange={handleChange} className="w-full p-2 border border-blue-300 rounded text-sm focus:ring-blue-500 outline-none font-bold" />
                  ))}
                  <p className="text-xs text-blue-600 mt-2 font-medium italic">Al imprimir, se generarán 2 páginas automáticamente.</p>
                </div>
              )}
            </div>
          </div>
          
           {activeTab === 'preweigh' && (
             <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">4. Logo Empresa</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300" />
            </div>
           )}

        </div>

        <div className="p-6 border-t bg-gray-50">
          <button 
            onClick={() => window.print()}
            className="w-full bg-[#6B52FF] hover:bg-[#503bc2] text-white font-black py-4 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md text-lg"
          >
            <Printer size={24} /> IMPRIMIR ETIQUETA
          </button>
        </div>
      </div>

      {/* PANEL DERECHO: Live Preview */}
      <div className="flex-1 bg-gray-300 overflow-auto flex flex-col items-center py-10 no-print-bg gap-10">
        
        {/* =========================================
            PLANTILLA 1: PREWEIGH PALLET TAG
            ========================================= */}
        {activeTab === 'preweigh' && (
          <div style={{ zoom: fontScale / 100 }} className="print-area bg-white relative w-[10.5in] h-[8in] border-[8px] border-black p-[0.5in_0.6in] shadow-2xl box-border flex flex-col shrink-0">
              <div className="flex justify-between items-end mb-[30px]">
                <div className="flex items-end text-[30px] font-black text-black">
                  Date Weighed: 
                  <input type="text" name="date" value={formData.date} onChange={handleChange} className="input-print border-b-4 border-black w-[250px] ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
                </div>
                <div className="h-[70px] flex items-center justify-end w-[300px]" title="Haz clic para cargar tu logo" onClick={() => document.querySelector('input[type="file"][accept="image/*"]').click()}>
                  {logoBase64 ? (
                    <img src={logoBase64} alt="Logo" className="max-h-full cursor-pointer" />
                  ) : (
                    <svg id="default-logo" width="260" height="70" viewBox="0 0 260 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="cursor-pointer">
                      <rect width="260" height="70" fill="white"/>
                      <circle cx="35" cy="35" r="30" fill="#6B52FF"/>
                      <path d="M22 48 L35 22 L52 22 L39 48 Z" fill="white"/>
                      <path d="M27 54 L42 54 L54 34 L39 34 Z" fill="#6B52FF"/>
                      <text x="75" y="32" font-family="Arial" font-size="26" font-weight="bold" fill="black">Tu Logo</text>
                      <text x="75" y="60" font-family="Arial" font-size="26" font-weight="bold" fill="black">Aquí</text>
                    </svg>
                  )}
                </div>
              </div>

              <div className="flex items-end mb-[22px] text-[30px] font-black text-black">
                Formula: <input type="text" name="formula" value={formData.formula} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex items-end mb-[22px] text-[30px] font-black text-black">
                Name: <input type="text" name="name" value={formData.name} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex items-end mb-[22px] text-[30px] font-black text-black">
                Batch# <input type="text" name="batch" value={formData.batch} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex items-end mb-[22px] text-[30px] font-black text-black">
                P.O.# <input type="text" name="po" value={formData.po} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex items-end mb-[22px] text-[30px] font-black text-black">
                Batches: <input type="text" name="batches" value={formData.batches} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              
              <div className="flex items-end mb-[20px] text-[30px] font-black text-black">
                Number Pallet 
                <input type="text" name="palletNum" value={formData.palletNum} onChange={handleChange} className="input-print border-b-4 border-black w-[150px] mx-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" /> 
                of 
                <input type="text" name="palletTotal" value={formData.palletTotal} onChange={handleChange} className="input-print border-b-4 border-black w-[150px] mx-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>

              <div className="absolute bottom-[0.25in] left-[0.6in] right-[0.6in] flex justify-between">
                <div className="box-print border-[6px] border-black w-[45%] h-[120px] flex items-center justify-center">
                  <input type="text" name="ile" value={formData.ile} onChange={handleChange} className="border-none w-full text-center text-[50px] font-black outline-none bg-transparent text-black" />
                </div>
                <div className="box-print border-[6px] border-black w-[45%] h-[120px] flex items-center justify-center">
                  <input type="text" name="identifier" value={formData.identifier} onChange={handleChange} className="border-none w-full text-center text-[50px] font-black outline-none bg-transparent text-black" />
                </div>
              </div>
          </div>
        )}

        {/* =========================================
            PLANTILLA 2: PREWEIGH PALLET MISSING
            ========================================= */}
        {activeTab === 'missing' && (
          <div style={{ zoom: fontScale / 100 }} className="print-area bg-white relative w-[10.5in] h-[8in] border-[8px] border-black p-[0.5in_0.6in] shadow-2xl box-border flex flex-col shrink-0">
              <div className="flex items-end mb-[26px] text-[30px] font-black text-black mt-2">
                Date Weighed: <input type="text" name="date" value={formData.date} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex items-end mb-[30px] text-[30px] font-black text-black">
                Name: <input type="text" name="name" value={formData.name} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex items-end mb-[26px] text-[30px] font-black text-black">
                Batch#: <input type="text" name="batch" value={formData.batch} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex items-end mb-[26px] text-[30px] font-black text-black">
                P.O.# <input type="text" name="po" value={formData.po} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex items-end mb-[30px] text-[30px] font-black text-black">
                Batches: <input type="text" name="batches" value={formData.batches} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex items-end mb-[35px] text-[30px] font-black text-black">
                Number Pallet 
                <input type="text" name="palletNum" value={formData.palletNum} onChange={handleChange} className="input-print border-b-4 border-black w-[150px] mx-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" /> 
                of 
                <input type="text" name="palletTotal" value={formData.palletTotal} onChange={handleChange} className="input-print border-b-4 border-black w-[150px] mx-5 text-[38px] font-bold text-center outline-none bg-transparent pb-1" />
              </div>
              <div className="flex flex-col gap-[20px] mt-auto">
                {[1, 2, 3, 4].map((num) => (
                  <div key={num} className="flex items-end">
                    <span className="text-[20px] font-medium text-black w-[280px]">MISSING INGREDIENT</span>
                    <input type="text" name={`missing${num}`} value={formData[`missing${num}`]} onChange={handleChange} className="input-print border-b-4 border-black flex-1 ml-4 text-[26px] font-bold outline-none bg-transparent pb-1 pl-2" />
                  </div>
                ))}
              </div>
          </div>
        )}

        {/* =========================================
            PLANTILLA 3: KEEP IN REFER (2 Páginas)
            ========================================= */}
        {activeTab === 'refer' && (
          <>
            {/* Página 1: KEEP IN REFER */}
            <div style={{ zoom: fontScale / 100 }} className="print-area bg-white relative w-[10.5in] h-[8in] border-[1px] border-blue-200 p-[0.5in_0.6in] shadow-2xl box-border flex flex-col shrink-0 text-center">
               <div className="text-[80px] font-black mb-4">ILE</div>
               <div className="text-[90px] font-black mb-8 leading-none">KEEP IN REFER:</div>
               
               <div className="flex flex-col gap-2 mb-auto">
                 {[1, 2, 3, 4].map(num => formData[`refer${num}`] && (
                   <div key={num} className="text-[45px] font-medium">{formData[`refer${num}`]}</div>
                 ))}
               </div>

               <div className="mt-auto">
                 <div className="text-[50px] font-black mb-2">BATCH: {formData.batch}</div>
                 <div className="text-[45px] font-black mb-2">{formData.formula} {formData.name} {formData.batches}</div>
                 <div className="text-[50px] font-black">{formData.identifier}</div>
               </div>
            </div>

            {/* Página 2: ITEMS IN REFER */}
            <div style={{ zoom: fontScale / 100 }} className="print-area bg-white relative w-[10.5in] h-[8in] border-[1px] border-blue-200 p-[0.5in_0.6in] shadow-2xl box-border flex flex-col shrink-0 text-center justify-center">
               <div className="text-[110px] font-black mb-8 leading-none tracking-wide">ITEMS IN</div>
               <div className="text-[110px] font-black mb-[80px] leading-none tracking-wide">REFER ILE</div>
               
               <div className="flex flex-col gap-4">
                 {[1, 2, 3, 4].map(num => formData[`refer${num}`] && (
                   <div key={num} className="text-[55px] font-medium">{formData[`refer${num}`]}</div>
                 ))}
               </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
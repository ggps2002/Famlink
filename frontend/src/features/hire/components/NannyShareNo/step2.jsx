import { Form, Checkbox } from "antd";
import { useEffect, useState } from "react";
import { toCamelCase } from "@shared/lib/toCamelCase";
import { InputTextArea } from "@shared/ui/Input";
import PropTypes from "prop-types";


export default function NannyNoStep2({
 formRef,
 data,
 defaultValue,
 defaultSubValue,
 textAreaHead,
 inputName,
 inputText,
 head,
 subHead,
noHeading=false
}) {
 const [form] = Form.useForm();
 const [selectedCheckboxes, setSelectedCheckboxes] = useState([]);


 const onCheckboxChange = (val) => {
   setSelectedCheckboxes((prev) => {
     const updatedCheckboxes = prev.includes(val)
       ? prev.filter((item) => item !== val) // Deselect if already selected
       : [...prev, val]; // Select the checkbox


     // Update the form value for the checkboxes
     form.setFieldsValue({
       [val]: !prev.includes(val),
     });


     return updatedCheckboxes;
   });
 };


 useEffect(() => {
   // Attach form instance to formRef if provided
   if (formRef) {
     formRef.current = form;
   }
 }, [form, formRef]);


 return (
   <div>
     {!noHeading && <p className="text-primary Livvic-Bold text-4xl text-center mb-6 width-form mx-auto">
       {head ? (
         head
       ) : (
         <>
           What type of services are
           <br /> you looking for?
         </>
       )}
     </p>}
     {subHead && (
       <p className="text-center font-normal text-xl mb-6">{subHead}</p>
     )}
     <div className="flex justify-center">
       <Form form={form} name="validateOnly" autoComplete="off">
         <div className="grid grid-cols-1 gap-4 flex-wrap lg:grid-cols-2 justify-center mx-auto">
           {/* Default Selected Option (Nanny) */}
           <Form.Item
             index={0}
             name={"nanny"}
             key={0}
             initialValue={true}
             valuePropName="checked"
             className="mb-0"
           >
             <div className="relative group cursor-not-allowed">
               <div
                 className={`
                   flex gap-4 px-6 py-4 items-start rounded-xl border-2 transition-all duration-300
                   bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md
                 `}
               >
                 {/* Custom Radio Button with Checkmark */}
                 <div className="flex items-center gap-2 mt-1">
                   <div className="relative">
                     <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 border-2 border-blue-600 flex items-center justify-center shadow-sm">
                       <svg
                         className="w-3.5 h-3.5 text-white"
                         fill="none"
                         stroke="currentColor"
                         viewBox="0 0 24 24"
                       >
                         <path
                           strokeLinecap="round"
                           strokeLinejoin="round"
                           strokeWidth={3}
                           d="M5 13l4 4L19 7"
                         />
                       </svg>
                     </div>
                     {/* Pulse animation ring */}
                     <div className="absolute inset-0 w-6 h-6 rounded-full bg-blue-400 opacity-30 animate-ping"></div>
                   </div>
                 </div>


                 {/* Content Box */}
                 <div className="flex-1 bg-white rounded-xl py-3 px-4 shadow-sm border border-blue-100">
                   <div className="flex items-center gap-2 mb-1">
                     <p className="Livvic-SemiBold text-lg text-blue-700 leading-tight">
                       {defaultValue}
                     </p>
                     <span className="px-2 py-1 text-xs Livvic-Medium bg-blue-100 text-blue-600 rounded-full">
                       Selected
                     </span>
                   </div>
                   <p className="Livvic-Medium text-sm text-gray-600">
                     {defaultSubValue}
                   </p>
                 </div>


                 {/* Selection Indicator */}
                 <div className="absolute top-2 right-2">
                   <div className="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></div>
                 </div>
               </div>
             </div>
           </Form.Item>


           {/* Selectable Options */}
           {data.map((v, i) => {
             const isSelected = selectedCheckboxes.includes(toCamelCase(v.name));
            
             return (
               <Form.Item
                 index={i + 1}
                 name={toCamelCase(v.name)}
                 key={i}
                 initialValue={false}
                 valuePropName="checked"
                 className="mb-0"
               >
                 <div
                   className="relative group cursor-pointer"
                   onClick={() => onCheckboxChange(toCamelCase(v.name))}
                 >
                   <div
                     className={`
                       flex gap-4 px-6 py-4 items-start rounded-xl border-2 transition-all duration-300 transform
                       ${isSelected
                         ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-md scale-[1.02]'
                         : 'bg-white border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md hover:scale-[1.01]'
                       }
                     `}
                   >
                     {/* Custom Checkbox */}
                     <div className="flex items-center gap-2 mt-1">
                       <div className="relative">
                         {isSelected ? (
                           <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 border-2 border-green-600 flex items-center justify-center shadow-sm">
                             <svg
                               className="w-3.5 h-3.5 text-white"
                               fill="none"
                               stroke="currentColor"
                               viewBox="0 0 24 24"
                             >
                               <path
                                 strokeLinecap="round"
                                 strokeLinejoin="round"
                                 strokeWidth={3}
                                 d="M5 13l4 4L19 7"
                               />
                             </svg>
                           </div>
                         ) : (
                           <div className="w-6 h-6 rounded-lg border-2 border-gray-300 bg-white group-hover:border-gray-400 transition-colors duration-200 flex items-center justify-center">
                             <div className="w-2 h-2 rounded-sm bg-gray-200 group-hover:bg-gray-300 transition-colors duration-200"></div>
                           </div>
                         )}
                        
                         {/* Pulse animation for selected items */}
                         {isSelected && (
                           <div className="absolute inset-0 w-6 h-6 rounded-lg bg-green-400 opacity-30 animate-ping"></div>
                         )}
                       </div>
                     </div>


                     {/* Content Box */}
                     <div className={`
                       flex-1 rounded-xl py-3 px-4 shadow-sm border transition-all duration-300
                       ${isSelected
                         ? 'bg-white border-green-100'
                         : 'bg-gray-50 border-gray-100 group-hover:bg-white group-hover:border-gray-200'
                       }
                     `}>
                       <div className="flex items-center gap-2 mb-1">
                         <p className={`
                           Livvic-SemiBold text-lg leading-tight transition-colors duration-300
                           ${isSelected ? 'text-green-700' : 'text-gray-700 group-hover:text-gray-900'}
                         `}>
                           {v.name}
                         </p>
                         {isSelected && (
                           <span className="px-2 py-1 text-xs Livvic-Medium bg-green-100 text-green-600 rounded-full animate-pulse">
                             Selected
                           </span>
                         )}
                       </div>
                       <p className={`
                         Livvic-Medium text-sm transition-colors duration-300
                         ${isSelected ? 'text-gray-600' : 'text-gray-500 group-hover:text-gray-600'}
                       `}>
                         {v.subHead}
                       </p>
                     </div>


                     {/* Selection Indicator */}
                     {isSelected && (
                       <div className="absolute top-2 right-2">
                         <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm animate-pulse"></div>
                       </div>
                     )}


                     {/* Hover Indicator */}
                     {!isSelected && (
                       <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                         <div className="w-3 h-3 bg-gray-400 rounded-full shadow-sm"></div>
                       </div>
                     )}
                   </div>


                   {/* Bottom border accent for selected items */}
                   {isSelected && (
                     <div className="absolute bottom-0 left-4 right-4 h-1 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"></div>
                   )}
                 </div>
               </Form.Item>
             );
           })}
         </div>


         {/* Additional Input Section */}
         {inputText && (
           <div className="mt-8">
             <InputTextArea
               grid={true}
               head={textAreaHead}
               name={inputName ? toCamelCase(inputName) : "Specify"}
               placeholder={inputName ? inputName : "Specify"}
             />
           </div>
         )}
       </Form>
     </div>


     {/* Selection Summary */}
     {selectedCheckboxes.length > 0 && (
       <div className="mt-8 flex justify-center">
         <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-6 py-4 max-w-md">
           <p className="text-sm Livvic-Medium text-blue-700 mb-2">
             You've selected {selectedCheckboxes.length + 1} service{selectedCheckboxes.length + 1 > 1 ? 's' : ''}:
           </p>
           <div className="flex flex-wrap gap-2">
             <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs Livvic-Medium rounded-full">
               {defaultValue}
             </span>
             {selectedCheckboxes.map((item, index) => (
               <span
                 key={index}
                 className="px-3 py-1 bg-green-100 text-green-700 text-xs Livvic-Medium rounded-full"
               >
                 {data.find(d => toCamelCase(d.name) === item)?.name}
               </span>
             ))}
           </div>
         </div>
       </div>
     )}
   </div>
 );
}


NannyNoStep2.propTypes = {
 formRef: PropTypes.object,
 data: PropTypes.arrayOf(
   PropTypes.shape({
     name: PropTypes.string.isRequired,
     subHead: PropTypes.string,
   })
 ).isRequired,
 defaultValue: PropTypes.string,
 defaultSubValue: PropTypes.string,
 textAreaHead: PropTypes.string,
 inputName: PropTypes.string,
 inputText: PropTypes.string,
 head: PropTypes.string,
 subHead: PropTypes.string,
};

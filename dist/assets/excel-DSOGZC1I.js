import{u as o,w as c}from"./index-CkYhtRd0.js";function k(t,s,n="Sheet1"){const r=o.json_to_sheet(t),e=o.book_new();o.book_append_sheet(e,r,n),c(e,`${s}.xlsx`)}export{k as exportToExcel};

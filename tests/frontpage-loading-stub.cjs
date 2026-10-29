// Route-only JSDOM tests isolate preparation; real media readiness is browser-tested.
exports.install = window => {
  window.FrontpageLoading = {
    prepare: async sequence => ({sequence,results:[],dispose(){},acquire:()=>window.document.createElement('img')})
  };
};

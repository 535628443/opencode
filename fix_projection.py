import re
f="packages/session-ui/src/timeline/projection.ts"
content = open(f).read()
content = re.sub(
    r"<<<<<<< HEAD\n          localModel && localModelID\n            \? \{ id: localModelID, providerID: localModel\.providerID, variant: localModel\.variant \}\n=======\n          localModel &&\n          typeof localModel === \"object\" &&\n          !Array\.isArray\(localModel\) &&\n          localModelID &&\n          typeof localModel\.providerID === \"string\"\n            \? \{\n                id: Model\.ID\.make\(localModelID\),\n                providerID: Provider\.ID\.make\(localModel\.providerID\),\n                variant: typeof localModel\.variant === \"string\" \? Model\.VariantID\.make\(localModel\.variant\) : undefined,\n              \}\n>>>>>>>[^\n]+\n",
    r"          localModel && localModelID\n            ? {\n                id: Model.ID.make(localModelID, { disableChecks: true }),\n                providerID: Provider.ID.make(localModel.providerID, { disableChecks: true }),\n                variant: typeof localModel.variant === \"string\" ? Model.VariantID.make(localModel.variant, { disableChecks: true }) : undefined,\n              }\n",
    content,
    flags=re.DOTALL
)
open(f,"w").write(content)

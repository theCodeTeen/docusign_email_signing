const docusign = require('docusign-esign');
const moment = require("moment");
const fs = require('fs');

//replace with your credentials
const privatekey = `your-private-key`;
const clientId = `your-integration-key`;
const impersonatedUserGuid = `your-user-id`;
const accountId = `your-account-id`;

//replace
const filename = "OfferLetterDemo.docx";
const sourcefilename = "offer.docx";
const signer1email = 'abc@gmail.com';
const signer1name = 'abc';
const signer2email = 'xyz@gmail.com';
const signer2name = 'xyz';
const clientname ='clientabc';

const getJWT = async ()=>{
    const jwtLifeSec = 10 * 60; // requested lifetime for the JWT is 10 min
    const dsApi = new docusign.ApiClient();
    dsApi.setOAuthBasePath("account-d.docusign.com"); // it should be domain only.
    const results = await dsApi.requestJWTUserToken(clientId,impersonatedUserGuid, "signature", privatekey,jwtLifeSec);

    const expiresAt = moment().add(results.body.expires_in, 's').subtract(10, 'm');
    return {
        accessToken: results.body.access_token,
        tokenExpirationTimestamp: expiresAt
    };
}

const makeTemplate = () => {
    const signer1 = docusign.Signer.constructFromObject({
      roleName: "signer1",
      recipientId: "1",
      routingOrder: "1",
    });
    const signer2 = docusign.Signer.constructFromObject({
      roleName: "signer2",
      recipientId: "2",
      routingOrder: "2",
    });
    const recipients = docusign.Recipients.constructFromObject({
      signers: [signer1,signer2]
    });
    // create the envelope template model
    const templateRequest = docusign.EnvelopeTemplate.constructFromObject({
      name: "Example document generation template",
      description: "Example template created via the API",
      emailSubject: "Please sign this document",
      shared: "false",
      recipients: recipients,
      status: "created"
    });
    return templateRequest;
};

const createATemplate = async (accessToken)=>{
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath("https://demo.docusign.net/restapi");
    dsApiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
    let templatesApi = new docusign.TemplatesApi(dsApiClient);

    const templateData = makeTemplate();
    const template = await templatesApi.createTemplate(accountId, { envelopeTemplate: templateData });
    const templateId = template.templateId;
    
    
    return templateId;
}

const templateDocument = (args) => {
    // read file
    const docBytes = fs.readFileSync(args.docFile);
    // create the document object
    const document = docusign.Document.constructFromObject({
        documentBase64: Buffer.from(docBytes).toString("base64"),
        name: filename,
        fileExtension: "docx",
        documentId: 1,
        order: 1,
        pages: 1,
    });
    const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
        documents: [document],
    });
    return envelopeDefinition
    };

const createADocument = async (accessToken,templateId)=>{
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath("https://demo.docusign.net/restapi");
    dsApiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
    let templatesApi = new docusign.TemplatesApi(dsApiClient);

    const documentData = templateDocument({docFile:sourcefilename});
    const documentId = '1';
    const res = await templatesApi.updateDocument(accountId, templateId, documentId, { envelopeDefinition: documentData });

    return res;
    
}

const recipientTabs = (signstring) => {
    const signHere = docusign.SignHere.constructFromObject({
        anchorString: signstring,
        anchorUnits: "pixels",
        anchorXOffset: "5",
        anchorYOffset: "-22"
    });
    const dateSigned = docusign.DateSigned.constructFromObject({
        anchorString: "date",
        anchorUnits: "pixels",
        anchorYOffset: "-22"
    });
    const tabs = docusign.Tabs.constructFromObject({
        signHereTabs: [signHere],
        dateSignedTabs: [dateSigned]
    });
    
    return tabs;
};

const createTabs = async (accessToken,templateId)=>{
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath("https://demo.docusign.net/restapi");
    dsApiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
    let templatesApi = new docusign.TemplatesApi(dsApiClient);

    let tabs = recipientTabs("sign_here_1");
    let recipientId = '1';
    await templatesApi.createTabs(accountId, templateId, recipientId, { templateTabs: tabs });

    tabs = recipientTabs("sign_here_2");
    recipientId = '2';
    await templatesApi.createTabs(accountId, templateId, recipientId, { templateTabs: tabs });
}


const makeEnvelope = (templateId, args,args2) => {
    // create the signer model
    const signer1 = docusign.TemplateRole.constructFromObject({
        email: args.candidateEmail,
        name: args.candidateName,
        roleName: "signer1"
    });
    const signer2 = docusign.TemplateRole.constructFromObject({
        email: args2.candidateEmail,
        name: args2.candidateName,
        roleName: "signer2"
    });
    // create the envelope model
    const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
        templateRoles: [signer1,signer2],
        status: "created",
        templateId: templateId
    });
    return envelopeDefinition;
};

const createEnvelopeDraft = async (accessToken,templateId)=>{

    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath("https://demo.docusign.net/restapi");
    dsApiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
    let envelopesApi = new docusign.EnvelopesApi(dsApiClient);

    const envelopeData = makeEnvelope(templateId, {candidateEmail:signer1email,candidateName:signer1name},{candidateEmail:signer2email,candidateName:signer2name});
    const envelope = await envelopesApi.createEnvelope(accountId, { envelopeDefinition: envelopeData });
    const envelopeId = envelope.envelopeId;
    return envelopeId;

}

const docGenFormFields = async (accessToken,envelopeId)=>{
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath("https://demo.docusign.net/restapi");
    dsApiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
    let envelopesApi = new docusign.EnvelopesApi(dsApiClient);


    const docGenFormFieldsResponse = await envelopesApi.getEnvelopeDocGenFormFields(accountId, envelopeId);
    const documentIdGuid = docGenFormFieldsResponse.docGenFormFields[0].documentId;
    return documentIdGuid;
}
const formFields = (documentId, args) => {
    const docGenFormFieldRequest = docusign.DocGenFormFieldRequest.constructFromObject({
      docGenFormFields: [
        docusign.DocGenFormFields.constructFromObject({
          documentId: documentId,
          docGenFormFieldList: [
            docusign.DocGenFormField.constructFromObject({
              name: "client",
              value: args.client
            })
          ]
        })
      ]
    });
    return docGenFormFieldRequest;
  };

const mergeDataWithFields = async (accessToken,docid,enid)=>{
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath("https://demo.docusign.net/restapi");
    dsApiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
    let envelopesApi = new docusign.EnvelopesApi(dsApiClient);

    const formFieldsData = formFields(docid, {client:clientname});
    await envelopesApi.updateEnvelopeDocGenFormFields(accountId, enid, { docGenFormFieldRequest: formFieldsData });
}

const sendEnvolope = async (accessToken,enid)=>{
    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath("https://demo.docusign.net/restapi");
    dsApiClient.addDefaultHeader("Authorization", "Bearer " + accessToken);
    let envelopesApi = new docusign.EnvelopesApi(dsApiClient);

    const sendEnvelopeReq = docusign.Envelope.constructFromObject({
        status: 'sent',
    });
    return await envelopesApi.update(accountId, enid, { envelope: sendEnvelopeReq })
}
const sendDocInEmail = async ()=>{
    const jwt = await getJWT();
    console.log(jwt);
    const templateId = await createATemplate(jwt.accessToken);
    console.log(templateId);
    const res = await createADocument(jwt.accessToken,templateId);
    console.log(res);
    await createTabs(jwt.accessToken,templateId);
    console.log("anchors added for sign and date");
    const enid= await createEnvelopeDraft(jwt.accessToken,templateId);
    console.log("envelope draft created",enid);
    const docid = await docGenFormFields(jwt.accessToken,enid);
    console.log(docid);
    const res2 = await mergeDataWithFields(jwt.accessToken,docid,enid);
    console.log(res2);
    const res3 = await sendEnvolope(jwt.accessToken,enid);
    console.log("done, done, done", res3);
}

sendDocInEmail();























// -----BEGIN PUBLIC KEY-----
// MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv6kKyFf/0Q7FuWO1ZynY
// SoWOZ5Ab4vnp1a+a7czGXwTF8LGJ+cinmvjWJwJspsEmdyL7xCjjSulKaJx8lhAE
// myIwW2TWvc+yKJ3aR2MLqUOU/P1dlB2AjFO+qE56Fo8O6c96jX4jFDbAHmIt1P+w
// boI1ATkYVqEo2H1VQ3edyk3N2XLP/kz/A+tEJ8KV9NNkHtrg2UxQ2VSXB1KvaMOT
// uQs82xZnsgihE92cuJBCBnzffT7ua8hNpwY1qmRxOuYsd5lSL8vBRalHrF26t6uT
// lZW0m10tSUvOqkUPalgXcpdux+rvcRetavJL8JZa8iB0JUWNME3jrMom0/ILFfZp
// cwIDAQAB
// -----END PUBLIC KEY-----

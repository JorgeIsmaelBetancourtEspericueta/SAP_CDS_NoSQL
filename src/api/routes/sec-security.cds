// 1. Import the data model
using {sec as mysec} from '../models/sec-users';
using {secValues as myval} from '../models/sec-values';


// 2. Import the controller to implement the Logic
@impl: 'src/api/controllers/sec-security-controller'

// 3. Define the method to expose the routes
// for all APIs of user security

service securityRouter @(path: '/api/security') {

    // 4. Instance the users entity
    entity entusers  as projection on mysec.users;
    entity entvalues as projection on myval.values;


    @Core.Description: 'get-Catalog'
    @path            : 'catalogs'
    function catalogs()                      returns array of entusers;

    @Core.Description: 'get-users'
    @path            : 'users'
    function users()                         returns array of entusers;

    @Core.Description: 'create-user'
    @path            : 'createuser'
    action   createuser(users : entusers)    returns array of entusers;

    @Core.Description: 'delete-fisico-logico'
    @path            : 'delete'
    action   delete()                        returns array of entusers;

    @Core.Description: 'create-value'
    @path            : 'createvalue'
    action   createvalue(values : entvalues) returns array of entvalues;
};

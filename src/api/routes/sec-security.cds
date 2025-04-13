// 1. Import the data model
using {sec as mysec} from '../models/sec-users';
using {secValues as myval} from '../models/sec-values';
using {secRoles as myroles} from '../models/sec-roles';


// 2. Import the controller to implement the Logic
@impl: 'src/api/controllers/sec-security-controller'

// 3. Define the method to expose the routes
// for all APIs of user security

service securityRouter @(path: '/api/security') {

    // 4. Instance the users entity
    entity entusers  as projection on mysec.users;
    entity entvalues as projection on myval.values;
    entity entroles  as projection on myroles.Roles;

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

    @Core.Description: 'update-value'
    @path            : 'updatevalue'
    action   updatevalue(values : entvalues) returns array of entvalues;

    @Core.Description: 'update-a-single-user'
    @path            : 'updateoneuser'
    action   updateoneuser(users : entusers) returns array of entusers;


    @Core.Description: 'get-UserRoles'
    @path            : 'getUserRoles'
    function getUserRoles()                  returns array of entroles;

    @Core.Description: 'get-roles'
    @path            : 'roles'
    function roles()                         returns array of entroles;

    @Core.Description: 'create-role'
    @path            : 'createrole'
    action   createrole(roles : entroles)    returns array of entroles;

    @Core.Description: 'update-role'
    @path            : 'updaterole'
    action   updaterole(roles : entroles)    returns array of entroles;

};

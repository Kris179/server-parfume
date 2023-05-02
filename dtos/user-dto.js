module.exports = class UserDto {
   UserID;
    Login;
   Password;
    FIO;
    Email;
    Admin;
    Activation;
    constructor(model) {
        this.UserID = model.UserID;
        this.Login = model.Login;
        this.Password = model.Password;
        this.FIO = model.FIO;
        this.Email = model.Email;
        this.Admin = model.Admin;
        this.Activation = model.Activation;
    }
}

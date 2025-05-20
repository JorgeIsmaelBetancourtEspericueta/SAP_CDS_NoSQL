namespace catLabels;

entity labels {
    COMPANYID   : Integer;
    CEDIID      : Integer;
    LABELID     : String;
    LABEL       : String;
    INDEX       : String;
    COLLECTION  : String;
    SECTION     : String;
    SEQUENCE    : Integer;
    IMAGE       : String;
    DESCRIPTION : String;
    DETAIL_ROW  : array of {
        ACTIVED        : Boolean;
        DELETED        : Boolean;
    };
    DETAIL_ROW_REG : array of {
        CURRENT : Boolean;
        REGDATE : DateTime;
        REGTIME : DateTime;
        REGUSER : String;
    };
};
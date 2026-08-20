from enum import StrEnum


class AttendanceMethod(StrEnum):
    QR_SCAN = "QR_SCAN"
    MANUAL = "MANUAL"


class ServiceType(StrEnum):
    SUNDAY_SERVICE = "SUNDAY_SERVICE"
    YOUTH_MEETING = "YOUTH_MEETING"
    SPECIAL_EVENT = "SPECIAL_EVENT"
    CAMP = "CAMP"
    CONFERENCE = "CONFERENCE"
    CLASS = "CLASS"
    OTHER = "OTHER"

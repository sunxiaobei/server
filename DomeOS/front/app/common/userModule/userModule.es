(() => {
    'use strict';
    let userModule = angular.module('userModule', []);
    userModule.controller('ModifyPwModalCtr', ['$scope', 'loginUser', '$modalInstance', '$domePublic', '$domeUser', function ($scope, loginUser, $modalInstance, $domePublic, $domeUser) {
        $scope.pwObj = {
            username: loginUser.username,
            oldpassword: '',
            newpassword: ''
        };
        $scope.newPwAgain = '';
        $scope.modiftPw = () => {
            $domeUser.userService.userModifyPw($scope.pwObj).then(() => {
                $domePublic.openPrompt('修改成功，请重新登录！').finally(() => {
                    location.href = '/login/login.html?redirect=' + encodeURIComponent(location.href);
                });

            }, () => {
                $domePublic.openWarning('修改失败，请重试！');
            });
        };

        $scope.cancel = () => {
            $modalInstance.dismiss('cancel');
        };
    }]).controller('ModifyUserInfoCtr', ['$scope', 'user', '$publicApi', '$modalInstance', '$domePublic', function ($scope, user, $publicApi, $modalInstance, $domePublic) {
        $scope.user = user;
        $scope.cancel = () => {
            $modalInstance.dismiss();
        };
        $scope.submit = () => {
            let userInfo = {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone

            };
            $publicApi.modifyUserInfo(userInfo).then(() => {
                $domePublic.openPrompt('修改成功！');
                $modalInstance.close(userInfo);
            }, (res) => {
                $domePublic.openWarning({
                    title: '修改失败！',
                    msg: res.data.resultMsg
                });
            });
        };
    }]);
    // 用户管理service
    userModule.factory('$domeUser', ['$http', '$q', '$domePublic', '$domeGlobal', '$domeModel', function ($http, $q, $domePublic, $domeGlobal, $domeModel) {
        let loginUser = {};
        const relatedGitLab = (loginData) => {
            let deferred = $q.defer();
            let gitOptions = $domeGlobal.getGloabalInstance('git');
            gitOptions.getData().then((info) => {
                if (!info[0].url) {
                    $domePublic.openWarning('未配置代码仓库地址！');
                    deferred.reject();
                } else {
                    let url = info[0].url;
                    $http.post(url + '/api/v3/session', angular.toJson(loginData)).then((res) => {
                        let info = res.data;
                        let params = {
                            name: info.username,
                            token: info.private_token
                        };
                        return params;
                    }, () => {
                        deferred.reject();
                    }).then(function (params) {
                        $http.post('/api/project/git/gitlabinfo', angular.toJson(params)).then((res) => {
                            deferred.resolve(res.data.result);
                        }, () => {
                            deferred.reject();
                        });
                    }, () => {
                        deferred.reject();
                    });
                }
            }, () => {
                deferred.reject();
            });
            return deferred.promise;
        };
        const alarmGroupService = function () {
            const AlarmGroup = function () {
                $domeModel.ServiceModel.call(this, '/api/alarm/group');
            };
            return new AlarmGroup();
        }();
        const userService = {
            getCurrentUser() {
                return $http.get('/api/user/get');
            },
            getUserList() {
                return $http.get('/api/user/list');
            },
            modifyUserInfo(user) {
                return $http.post('/api/user/modify', angular.toJson(user));
            },
            // 管理员修改：@param userInfo:{username:'username', password:'password'}
            modifyPw(userInfo) {
                return $http.post('/api/user/adminChangePassword', angular.toJson(userInfo));
            },
            // 用户修改： @param userInfo: {username:'username', oldpassword:'oldpassword', newpassword:'newpassword'}
            userModifyPw(userInfo) {
                return $http.post('/api/user/changePassword', angular.toJson(userInfo));
            },
            deleteUser(userId) {
                return $http.delete('/api/user/delete/' + userId);
            },
            createUser(userInfo) {
                return $http.post('/api/user/create', angular.toJson(userInfo));
            },
            // 获取单个资源用户信息
            getSigResourceUser(resourceType, id) {
                return $http.get('/api/resource/' + resourceType + '/' + id);
            },
            // 获取某类资源用户信息
            getResourceUser(resourceType) {
                return $http.get('/api/resource/' + resourceType + '/useronly');
            },
            modifyResourceUser(resourceInfo) {
                return $http.put('/api/resource', angular.toJson(resourceInfo));
            },
            deleteResourceUser(resourceType, resourceId, ownerType, ownerId) {
                return $http.delete('/api/resource/' + resourceType + '/' + resourceId + '/' + ownerType + '/' + ownerId);
            },
            // 获取资源组信息
            getGroupList() {
                return $http.get(' /api/namespace/list');
            },
            // 获取组列表
            getGroup() {
                return $http.get('/api/group/list');
            },
            getGroupInfo(groupId) {
                return $http.get('/api/group/get/' + groupId);
            },
            deleteGroup(groupId) {
                return $http.delete('/api/group/delete/' + groupId);
            },
            createGroup(groupData) {
                return $http.post('/api/group/create', angular.toJson(groupData));
            },
            modifyGroupUsers(groupId, users) {
                return $http.post('/api/group_members/' + groupId, angular.toJson(users));
            },
            deleteGroupUser(groupId, userId) {
                return $http.delete('/api/group_members/' + groupId + '/' + userId);
            },
            getGroupUser(groupId) {
                return $http.get('/api/group_members/' + groupId);
            },
            logout() {
                return $http.get('/api/user/logout');
            }
        };
        const getLoginUser = () => {
            let deferred = $q.defer();
            if (loginUser.id) {
                deferred.resolve(loginUser);
            } else {
                userService.getCurrentUser().then((res) => {
                    loginUser = res.data.result;
                    deferred.resolve(loginUser);
                });
            }
            return deferred.promise;
        };

        // 资源成员
        class ResourceUser {
            constructor(resourceInfo) {
                this.init(resourceInfo);
            }
            init(resourceInfo) {
                resourceInfo.userInfos = resourceInfo.userInfos || [];
                resourceInfo.groupInfo = resourceInfo.groupInfo || [];
                for (let user of resourceInfo.userInfos) {
                    user.isDirty = false;
                    user.newRole = user.role;
                }
                this.resourceInfo = resourceInfo;
            }
            toggleRole(user, newRole) {
                if (user.newRole !== newRole) {
                    user.newRole = newRole;
                }
                user.isDirty = user.newRole !== user.role;
            }
            saveRole(user) {
                let data, defered = $q.defer();
                if (this.resourceInfo.resourceType == 'alarm') {
                    data = [{
                        userId: user.userId,
                        role: user.newRole,
                        username: user.username
                    }];
                    alarmGroupService.setData(data).then(() => {
                        user.isDirty = false;
                        user.role = user.newRole;
                        defered.resolve();
                    }, () => {
                        defered.reject();
                        $domePublic.openWarning('修改失败！');
                    });
                } else if (this.resourceInfo.resourceType == 'group') {
                    data = {
                        members: [{
                            userId: user.userId,
                            role: user.newRole
                        }]
                    };
                    userService.modifyGroupUsers(this.resourceInfo.resourceId, data).then(() => {
                        user.isDirty = false;
                        user.role = user.newRole;
                        defered.resolve();
                    }, () => {
                        defered.reject();
                        $domePublic.openWarning('修改失败！');
                    });
                } else {
                    data = {
                        resourceId: this.resourceInfo.resourceId,
                        resourceType: this.resourceInfo.resourceType,
                        ownerInfos: [{
                            ownerId: user.userId,
                            ownerType: user.ownerType,
                            role: user.newRole
                        }]
                    };
                    userService.modifyResourceUser(data).then(() => {
                        user.isDirty = false;
                        user.role = user.newRole;
                        defered.resolve();
                    }, () => {
                        defered.reject();
                        $domePublic.openWarning('修改失败！');
                    });
                }
                return defered.promise;
            }
            deleteUser(user, isSelf) {
                let defered = $q.defer();

                const spliceUser = () => {
                    for (let i = 0; i < this.resourceInfo.userInfos.length; i++) {
                        if (this.resourceInfo.userInfos[i].userId === user.userId) {
                            this.resourceInfo.userInfos.splice(i, 1);
                            break;
                        }
                    }
                };
                if (this.resourceInfo.resourceType == 'group') {
                    userService.deleteGroupUser(this.resourceInfo.resourceId, user.userId).then(() => {
                        spliceUser();
                        defered.resolve();
                    }, (res) => {
                        defered.reject();
                        $domePublic.openWarning({
                            title: '删除失败！',
                            msg: 'Message:' + res.data.resultMsg
                        });
                    });
                } else {
                    let promptTxt;
                    if (isSelf && this.resourceInfo.resourceType == 'alarm') {
                        promptTxt = '您确定要离开报警组吗？';
                    }
                    $domePublic.openDelete(promptTxt).then(() => {
                        let deleteFunc = () => {
                            if (this.resourceInfo.resourceType == 'alarm') {
                                return alarmGroupService.deleteData(user.userId);
                            } else {
                                return userService.deleteResourceUser(this.resourceInfo.resourceType, this.resourceInfo.resourceId, user.ownerType, user.userId);
                            }
                        };
                        deleteFunc().then(() => {
                            defered.resolve();
                            spliceUser();
                        }, (res) => {
                            defered.reject();
                            $domePublic.openWarning({
                                title: '删除失败！',
                                msg: 'Message:' + res.data.resultMsg
                            });
                        });
                    }, () => {
                        defered.reject();
                    });
                }
                return defered.promise;
            }
        }
        class UserGroupList {
            constructor(userGroupInfo) {
                this.userGroup = {};
                this.init(userGroupInfo);
            }
            init(userGroupInfo) {
                this.userGroupList = userGroupInfo || [];
                if (this.userGroupList[0]) {
                    this.toggle(0);
                }
            }
            toggle(index) {
                this.userGroup = this.userGroupList[index];
            }

        }
        const getInstance = $domeModel.instancesCreator({
            UserGroupList: UserGroupList,
            ResourceUser: ResourceUser
        });

        return {
            alarmGroupService: alarmGroupService,
            userService: userService,
            relatedGitLab: relatedGitLab,
            getLoginUser: getLoginUser,
            getInstance: getInstance
        };
    }]);
    window.userModule = userModule;
})();
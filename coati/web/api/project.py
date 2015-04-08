import json
import urllib2
import base64

from flask import g
from flask.ext.restful import request

from coati.core.models.user import User
from coati.core.models.project import Project, Column, ProjectMember
from coati.core.models.ticket import Ticket, Attachment
from coati.web.api.auth import AuthResource
from coati.utils import send_new_member_email_async, save_notification
from coati.web.api import errors as api_errors
from coati.web.api.auth.utils import current_user


class ProjectList(AuthResource):
    """
    Project Resource List
    """

    def get(self):
        """
        Get the list of projects that the user belongs
        :return: List of project resources
        """
        prj_mem = ProjectMember.get_by_member(current_user)
        projects = []
        for pm in prj_mem:
            if pm.project.active:
                projects.append(pm.project.to_dict())
            elif pm.project.owner.id == current_user.id:
                projects.append(pm.project.to_dict())
        return projects, 200

    def post(self):
        """
        Create Project
        """
        data = request.get_json(silent=True)
        if not data:
            raise api_errors.InvalidAPIUsage(
                api_errors.INVALID_JSON_BODY_MSG
            )

        prj = Project(name=data.get('name'),
                      owner=g.user.to_dbref())
        prj.active = data.get('active')
        prj.private = data.get('private')
        prj.prefix = data.get('prefix', data.get('name')[:3].upper())
        prj.description = data.get('description')
        prj.project_type = data.get('project_type', 'S')

        # Add initial config
        prj.sprint_duration = 15
        prj.save()

        # add owner as member
        pm = ProjectMember(project=prj)
        pm.member = prj.owner
        pm.is_owner = True
        pm.save()

        # Add 3 columns states
        col_names = ['ToDo', 'In Progress', 'Done']
        for index, c in enumerate(col_names):
            col = Column()
            col.title = c
            col.project = prj
            if index == len(col_names) - 1:
                col.done_column = True
            col.save()

        # save activity
        save_notification(project_pk=prj.pk,
                          verb='new_project',
                          data=prj.to_dict())

        return prj.to_dict(), 201


class ProjectInstance(AuthResource):
    """
    Project Resource
    """

    def get(self, project_pk):
        """
        Get a Project Instance
        :param project_pk: the ID of the project
        :return: a Project Object
        """
        prj = Project.get_by_id(project_pk).select_related(max_depth=2)
        if prj is None:
            raise api_errors.MissingResource(
                api_errors.INVALID_PROJECT_MSG
            )

        return prj.to_dict(), 200

    def put(self, project_pk):
        """
        Update a Project Instance
        :param project_pk:
        :return:
        """
        project = Project.get_by_id(project_pk)

        if not project:
            raise api_errors.MissingResource(
                api_errors.INVALID_PROJECT_MSG
            )

        data = request.get_json(silent=True)

        if not data:
            raise api_errors.InvalidAPIUsage(
                api_errors.INVALID_JSON_BODY_MSG
            )

        project.active = data.get('active')
        project.description = data.get('description')
        project.name = data.get('name')
        owner = User.get_by_id(data.get('owner_id'))

        if not owner:
            raise api_errors.InvalidAPIUsage(
                api_errors.INVALID_USER_ID_MSG
            )

        project.owner = owner.to_dbref()
        project.private = data.get('private')
        project.sprint_duration = data.get('sprint_duration')
        project.prefix = data.get('prefix')
        project.project_type = data.get('project_type', 'S')
        project.save()

        # save activity
        save_notification(project_pk=project.pk,
                          verb='update_project',
                          data=project.to_dict())

        return project.to_dict(), 200


    def delete(self, project_pk):
        """
        Delete a Project Instance
        :param project_pk: Project ID
        :return: nothing
        """
        project = Project.get_by_id(project_pk)
        if not project:
            raise api_errors.MissingResource(
                api_errors.INVALID_PROJECT_MSG
            )

        project.delete()
        return {}, 204


class ProjectColumns(AuthResource):
    """
    Columns Resource List
    """

    def get(self, project_pk):
        """
        :param project_pk: Project ID
        :return: List of columns
        """
        return Column.get_by_project(project_pk).to_json()

    def post(self, project_pk):
        """
        :param project_pk: Project ID
        :return: Column Resource created
        """
        data = request.get_json(silent=True)
        if not data:
            raise api_errors.InvalidAPIUsage(
                api_errors.INVALID_JSON_BODY_MSG
            )

        project = Project.get_by_id(project_pk)
        if not project:
            raise api_errors.MissingResource(
                api_errors.INVALID_PROJECT_MSG
            )

        col = Column()
        col.order = Column.objects.count()
        col.project = project
        col.title = data.get('title')
        col.color_max_cards = data.get('color_max_cards', '#FF0000')
        col.done_column = data.get('done_column', False)
        col.max_cards = data.get('max_cards', 9999)

        # Check if already exists one Done column
        if col.done_column:
            columns = Column.get_by_project(project)
            for c in columns:
                if c.done_column:
                    c.done_column = False
                    c.save()
        col.save()

        # save activity
        save_notification(project_pk=project.pk,
                          verb='new_column',
                          data=col.to_dict())

        return col.to_dict(), 200


class ProjectColumn(AuthResource):
    """
    Columns Resource
    """

    def get(self, project_pk, column_pk):
        """
        Get Column Instance

        :param project_pk: Project that belongs
        :param column_pk: Id of the column
        :return: Object Column
        """

        return Column.get_by_id(column_pk).to_dict()

    def put(self, project_pk, column_pk):
        """
        Update a column instance

        :param project_pk: Project that belongs
        :param column_pk: Id of the column
        :return: The updated resource
        """

        col = Column.get_by_id(column_pk)
        if not col:
            raise api_errors.MissingResource(
                api_errors.INVALID_OBJECT_ID_MSG
            )

        data = request.get_json(silent=True)

        if not data:
            raise api_errors.InvalidAPIUsage(
                api_errors.INVALID_JSON_BODY_MSG
            )

        col.title = data.get('title')
        col.color_max_cards = data.get('color_max_cards', '#FF0000')
        col.done_column = data.get('done_column', False)
        col.max_cards = data.get('max_cards', 9999)

        # check set other columns of the project to done_column in False
        if col.done_column:
            Column.clear_done_columns(project_pk)
        col.save()

        # save activity
        save_notification(project_pk=project_pk,
                          verb='update_column',
                          data=col.to_dict())

        return col.to_dict(), 200

    def delete(self, project_pk, column_pk):
        """
        Delete a column resource

        :param project_pk: Project that belongs
        :param column_pk:Id of the column
        :return: Nothing
        """
        col = Column.get_by_id(column_pk)
        if not col:
            raise api_errors.MissingResource(
                api_errors.INVALID_OBJECT_ID_MSG
            )
        # save activity
        save_notification(project_pk=project_pk,
                          verb='delete_column',
                          data=col.to_dict())

        col.delete()
        return {}, 204


class ProjectColumnsOrder(AuthResource):
    """
    Columns Order by Project
    """

    def post(self, project_pk):
        """
        Update order of columns

        :param project_pk: project id
        :return: same data sent
        """
        data = request.get_json(silent=True)
        if not data:
            raise api_errors.InvalidAPIUsage(
                api_errors.INVALID_JSON_BODY_MSG
            )

        for index, col_id in enumerate(data):
            col = Column.get_by_id(col_id)
            if col is not None:
                col.order = index
                col.save()

        # save activity
        save_notification(project_pk=project_pk,
                          verb='order_columns',
                          data=data)
        return data, 200


class ProjectMemberInstance(AuthResource):
    """
    Project Member
    """

    def get(self, project_pk, member_pk):
        """
        Get a Single instance of a ProjectMember

        :param project_pk: project ID
        :param member_pk: ProjectMember ID
        :return: ProjectMember object
        """
        pm = ProjectMember.get_by_id(member_pk)
        if not pm:
            raise api_errors.MissingResource(
                api_errors.INVALID_OBJECT_ID_MSG
            )
        return pm.to_dict()

    def put(self, project_pk, member_pk):
        """
        Update ProjectMember Resource

        :param project_pk: ProjectID
        :param member_pk: Project MemberID
        :return: ProjectMember Instance
        """

        pm = ProjectMember.get_by_id(member_pk)
        project = Project.get_by_id(project_pk)

        if not pm:
            raise api_errors.MissingResource(
                api_errors.INVALID_OBJECT_ID_MSG
            )

        if not project:
            raise api_errors.MissingResource(
                api_errors.INVALID_PROJECT_MSG
            )

        ProjectMember.clear_ownership(project_pk)

        pm.is_owner = True
        project.owner = pm.member
        pm.save()
        return pm.to_dict(), 200


    def delete(self, project_pk, member_pk):
        """
        Delete ProjectMember Resource

        :param project_pk: ProjectID
        :param member_pk: Project MemberID
        :return: Nothing
        """

        pm = ProjectMember.get_by_id(member_pk)
        if not pm:
            raise api_errors.MissingResource(
                api_errors.INVALID_OBJECT_ID_MSG
            )

        pm.delete()
        return {}, 204


class ProjectMembers(AuthResource):
    """
    Project Members List
    """

    def get(self, project_pk):
        """
        Return list of project members by project

        :param project_pk: Project ID
        :return: List of project members
        """
        return ProjectMember.objects(project=project_pk).to_json()

    def post(self, project_pk):
        """
        Create a new Project Member

        :param project_pk: Project ID
        :return: the created ProjectMember
        """

        data = request.get_json(silent=True)
        if not data:
            raise api_errors.InvalidAPIUsage(
                api_errors.INVALID_JSON_BODY_MSG
            )

        project = Project.get_by_id(project_pk)
        if not project:
            raise api_errors.MissingResource(
                api_errors.INVALID_PROJECT_MSG
            )

        members_added = []
        errors_list = []
        for member in data:
            if member.get('value'):
                user = User.get_by_id(member.get('value'))
                if not user:
                    errors_list.append(
                        dict(member=api_errors.INVALID_MEMBER_MSG))
            else:
                user = User(email=member.get('text'))
                user.active = False
                user.save()
            if project.owner.id != user.id:
                m = ProjectMember.get_by_project_member(project_pk, user)
                if not m:
                    m = ProjectMember(project=project_pk)
                    m.member = user
                    m.save()
                    # Send email notification
                    send_new_member_email_async(m.member, project)
                    members_added.append(m.to_dict())
                else:
                    errors_list.append(dict(
                        member=api_errors.INVALID_ALREADY_ADDED_MSG
                    ))
        if errors_list:
            raise api_errors.InvalidAPIUsage(
                api_errors.VALIDATION_ERROR_MSG,
                payload=errors_list
            )

        if members_added:
            # save activity
            save_notification(project_pk=project_pk,
                              verb='new_members',
                              data={'members': members_added})
        return {}, 200


class ProjectImport(AuthResource):
    """
    Import Data Project
    """

    def post(self, project_pk):
        """
        Import cards and columns

        :param project_pk: Project ID
        :return: List of Tickets and Columns imported
        """
        try:
            body = json.loads(request.form.get('data'))
        except ValueError, e:
            raise api_errors.InvalidAPIUsage(
                api_errors.ERROR_PARSING_JSON_MSG
            )

        imported_file = request.files.get('file')

        if not imported_file:
            raise api_errors.InvalidAPIUsage(
                api_errors.REQUIRED_MSG
            )

        project = Project.get_by_id(project_pk)
        if not project:
            raise api_errors.MissingResource(
                api_errors.INVALID_PROJECT_MSG
            )

        data = json.loads(imported_file.stream.read().decode('utf-8'),
                          encoding='UTF-8')

        import_args = body.get('data')
        tickets = []
        last_ticket = Ticket.get_last_ticket(project_pk)
        starting_number = last_ticket.number if last_ticket else 1
        amazon_url = 'https://trello-attachments.s3.amazonaws.com/'

        if import_args.get('include_cards'):
            for card in data.get('cards'):
                t = Ticket()
                t.title = card.get('name')
                t.description = card.get('desc')
                t.labels = [l.get('name') for l in card.get('labels')]
                t.closed = card.get('closed')

                for att in card.get('attachments'):
                    location = att.get('url')
                    if amazon_url in location:
                        file_location = urllib2.urlopen(location)
                        file_data = file_location.read()
                        if file_data:
                            att_file = Attachment()
                            att_file.name = att.get('name')
                            att_file.size = att.get('bytes')
                            att_file.type = att.get('mimeType')
                            att_file.data = base64.b64encode(file_data)
                            att_file.save()
                            t.files.append(att_file)
                t.project = project
                t.number = starting_number
                t.order = starting_number - 1
                # by default user story
                t.type = 'U'
                t.points = 0
                tickets.append(t)
                starting_number += 1

        columns = []
        if import_args.get('include_cols'):
            for col in data.get('lists'):
                if not col.get('closed'):
                    new_col = Column()
                    new_col.title = col.get('name')
                    new_col.project = project
                    columns.append(new_col)

        if tickets:
            Ticket.objects.insert(tickets, load_bulk=False)
        if columns:
            Column.objects.insert(columns, load_bulk=False)

        # save activity
        save_notification(project_pk=project_pk,
                          verb='import',
                          data=data)

        return [tickets, columns], 200
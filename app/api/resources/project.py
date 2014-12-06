__author__ = 'gastonrobledo'

from bson import json_util
from flask import jsonify, session
from flask.ext.restful import Resource, request
from mongoengine import DoesNotExist

from app.schemas import User, Project, Column


class ProjectList(Resource):
    def __init__(self):
        super(ProjectList, self).__init__()


    def get(self):
        return Project.objects.all().to_json(), 200

    def post(self):
        """
        Create Project
        """
        data = request.get_json(force=True, silent=True)
        if not data:
            msg = "payload must be a valid json"
            return jsonify({"error": msg}), 400

        user_session = session.get('user')
        if not user_session:
            return jsonify({"error": 'owner user does not exist'}), 400
        try:
            user_id = user_session['_id']['$oid']
            user = User.objects.get(pk=user_id)
        except DoesNotExist, e:
            return jsonify({"error": 'owner user does not exist'}), 400

        prj = Project(name=data.get('name'),
                      owner=user.to_dbref())
        prj.active = data.get('active')
        prj.private = data.get('private')
        prj.prefix = data.get('prefix') or data.get('name')[3:0]
        prj.description = data.get('description')
        prj.save()
        return prj.to_json(), 201


class ProjectInstance(Resource):
    def __init__(self):
        super(ProjectInstance, self).__init__()

    def get(self, slug):
        prj = Project.objects.get(slug=slug).select_related(max_depth=2)
        return prj.to_json(), 200

    def put(self, slug):
        project = Project.objects.get(slug=slug)
        data = request.get_json(force=True, silent=True)
        if not data:
            msg = "payload must be a valid json"
            return jsonify({"error": msg}), 400
        project.active = data.get('active', project.active)
        project.description = data.get('description', project.description)
        project.name = data.get('name', project.name)
        owner = User.objects.get(id=data.get('owner'))
        project.owner = owner or project.owner
        project.private = data.get('private', project.private)
        project.save()
        return project.to_json(), 200

    def delete(self, slug):
        project = Project.objects.get(slug=slug)
        project.delete()
        return {}, 204


class ProjectSettings(Resource):
    def __init__(self):
        super(ProjectSettings, self).__init__()

    def post(self, project_pk):
        data = request.get_json(force=True, silent=True)
        if not data:
            msg = "payload must be a valid json"
            return jsonify({"error": msg}), 400
        project = Project.objects.get(pk=project_pk)
        col = Column()
        col.project = project
        col.order = Column.objects.count()
        col.title = data.get('title')
        col.color_max_cards = data.get('color_max_cards', '#FF0000')
        col.done_column = data.get('done_column', False)
        col.max_cards = data.get('max_cards', 9999)

        # Check if already exists one Done column
        columns = Column.objects(project=project)
        for c in columns:
            if c.done_column:
                c.done_column = False
                c.update()

        col.save()
        return col.to_json(), 201


